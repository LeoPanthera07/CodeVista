'use strict';

/**
 * CodeVista Backend — API Gateway and Process Orchestrator
 *
 * Sets up the API Gateway, spawns the microservices, proxies incoming request streams
 * (including multipart file uploads and SSE chat streams), and manages graceful shutdown.
 */

const path = require('path');
const { fork } = require('child_process');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Load environment variables BEFORE anything else
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Database (initializes schema on first call)
const { getDb, closeDb } = require('./database/db');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── Environment Ports for Microservices ─────────────────────────────────────
const PORT_AUTH = process.env.PORT_AUTH || '3002';
const PORT_REPO = process.env.PORT_REPO || '3003';
const PORT_CHAT = process.env.PORT_CHAT || '3004';
const PORT_DOC = process.env.PORT_DOC || '3005';

// ── Orchestration: Spawn Microservices ──────────────────────────────────────
const processes = [];

if (!process.env.IS_CHILD_SERVICE) {
  const services = [
    { name: 'Auth Service', path: path.join(__dirname, 'microservices', 'auth-service.js') },
    { name: 'Repository Service', path: path.join(__dirname, 'microservices', 'repository-service.js') },
    { name: 'Chat Service', path: path.join(__dirname, 'microservices', 'chat-service.js') },
    { name: 'Documentation Service', path: path.join(__dirname, 'microservices', 'documentation-service.js') },
  ];

  services.forEach((service) => {
    console.log(`[Orchestrator] Starting ${service.name}…`);
    const child = fork(service.path, [], {
      env: {
        ...process.env,
        IS_CHILD_SERVICE: 'true', // prevent recursive spawning
      },
    });

    child.on('error', (err) => {
      console.error(`[Orchestrator] Failed to start ${service.name}:`, err.message);
    });

    child.on('exit', (code, signal) => {
      console.log(`[Orchestrator] ${service.name} exited with code ${code} (signal: ${signal})`);
    });

    processes.push(child);
  });
}

// ── Security & standard middleware for local Gateway endpoints ──────────────
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(morgan(process.env.LOG_LEVEL || 'dev'));

// ── Gateway Proxy Helper ────────────────────────────────────────────────────
/**
 * Creates a reverse proxy middleware forwarding requests to the target URL.
 * Passes the raw stream (handles JSON, files, and SSE streams).
 * @param {string} targetUrl
 * @returns {express.RequestHandler}
 */
function proxyTo(targetUrl) {
  const url = new URL(targetUrl);
  return (req, res) => {
    const headers = { ...req.headers };
    delete headers.host; // Let Node.js generate the correct Host header

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: req.originalUrl,
      method: req.method,
      headers: headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error(`[Gateway] Proxy error on path ${req.originalUrl} to ${targetUrl}:`, err.message);
      res.status(502).json({ success: false, error: `Bad Gateway: ${err.message}` });
    });

    // Stream client request body (JSON, files, etc.) straight to downstream microservice
    req.pipe(proxyReq, { end: true });
  };
}

// ── API Health check (Local Gateway Route) ──────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env: NODE_ENV,
      orchestration: process.env.IS_CHILD_SERVICE ? 'child' : 'orchestrator',
    },
  });
});

// ── API Proxy Routes ────────────────────────────────────────────────────────
// Note: More specific paths must be defined before generic ones.
app.use('/api/auth', proxyTo(`http://localhost:${PORT_AUTH}`));
app.use('/api/repositories/:id/chat', proxyTo(`http://localhost:${PORT_CHAT}`));
app.use('/api/repositories/:id/documentation', proxyTo(`http://localhost:${PORT_DOC}`));
app.use('/api/repositories', proxyTo(`http://localhost:${PORT_REPO}`));

// ── Serve React client in production ────────────────────────────────────────
if (NODE_ENV === 'production') {
  const clientBuild = path.resolve(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// ── Eagerly initialize the database schema ──────────────────────────────────
getDb();

// ── Start Server ────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║       CodeVista API Gateway Running          ║
  ║──────────────────────────────────────────────║
  ║  Port:        ${String(PORT).padEnd(30)}║
  ║  Environment: ${NODE_ENV.padEnd(30)}║
  ║  Gateway:     http://localhost:${PORT}/api     ║
  ╚══════════════════════════════════════════════╝
  `);
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[Gateway] ${signal} received — shutting down gracefully…`);
  
  // Terminate all microservice processes
  processes.forEach((child) => {
    try {
      child.kill('SIGTERM');
    } catch (err) {
      // ignore
    }
  });

  server.close(() => {
    closeDb();
    console.log('[Gateway] Goodbye.');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('[Gateway] Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[Gateway] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Gateway] Uncaught exception:', err);
  shutdown('uncaughtException');
});

module.exports = app;
