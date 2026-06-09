'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { getDb, closeDb } = require('../database/db');
const repositoryRoutes = require('../routes/repository-routes');
const { authenticateToken } = require('../middleware/auth');
const { errorHandler, notFoundHandler } = require('../middleware/error-handler');

const app = express();
const PORT = parseInt(process.env.PORT_REPO || '3003', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(morgan(process.env.LOG_LEVEL || 'dev'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Repository Routes (mount under /api/repositories with JWT token authentication)
app.use('/api/repositories', authenticateToken, repositoryRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Eagerly initialize DB connection for the process
getDb();

const server = app.listen(PORT, () => {
  console.log(`[Repository Service] Running on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`\n[Repository Service] ${signal} received — shutting down gracefully…`);
  server.close(() => {
    closeDb();
    console.log('[Repository Service] Goodbye.');
    process.exit(0);
  });
  
  setTimeout(() => {
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
