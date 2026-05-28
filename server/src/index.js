'use strict';

/**
 * CodeVista Backend — Main Entry Point
 *
 * Sets up Express with security middleware, routes, error handling,
 * and graceful shutdown. Serves the React client build in production.
 */

const path = require('path');

// Load environment variables BEFORE anything else
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Database (initialises schema on first call)
const { getDb, closeDb } = require('./database/db');

// Routes
const authRoutes = require('./routes/auth-routes');
const repositoryRoutes = require('./routes/repository-routes');
const chatRoutes = require('./routes/chat-routes');
const documentationRoutes = require('./routes/documentation-routes');

// Middleware
const { authenticateToken, verifyRepoOwnership } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

// ═════════════════════════════════════════════════════════════════════════════
// Create Express App
// ═════════════════════════════════════════════════════════════════════════════

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// ── Security & standard middleware ──────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false, // disable in dev for ease
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(morgan(process.env.LOG_LEVEL || 'dev'));

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check ────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env: NODE_ENV,
    },
  });
});

// ── API Routes ──────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/repositories', authenticateToken, repositoryRoutes);
app.use('/api/repositories/:id/chat', authenticateToken, verifyRepoOwnership, chatRoutes);
app.use('/api/repositories/:id/documentation', authenticateToken, verifyRepoOwnership, documentationRoutes);

// ── Serve React client in production ────────────────────────────────────────

if (NODE_ENV === 'production') {
  const clientBuild = path.resolve(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientBuild));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// ── Error handling (must be after routes) ───────────────────────────────────

app.use(notFoundHandler);
app.use(errorHandler);

// ═════════════════════════════════════════════════════════════════════════════
// Start Server
// ═════════════════════════════════════════════════════════════════════════════

// Eagerly initialise the database
getDb();

const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║        CodeVista Backend Running             ║
║──────────────────────────────────────────────║
║  Port:        ${String(PORT).padEnd(30)}║
║  Environment: ${NODE_ENV.padEnd(30)}║
║  API:         http://localhost:${PORT}/api     ║
╚══════════════════════════════════════════════╝
`);
});

// ── Graceful shutdown ───────────────────────────────────────────────────────

/**
 * Perform a clean shutdown: close HTTP server, then database.
 * @param {string} signal
 */
function shutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully…`);
  server.close(() => {
    closeDb();
    console.log('[Server] Goodbye.');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
  shutdown('uncaughtException');
});

module.exports = app; // export for testing
