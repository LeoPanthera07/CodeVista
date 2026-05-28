'use strict';

/**
 * Global error-handling middleware.
 * Logs the error and returns a consistent JSON response.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
function errorHandler(err, req, res, _next) {
  // Determine HTTP status
  const status = err.status || err.statusCode || 500;

  // Log server errors
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);
  } else {
    console.warn(`[WARN] ${req.method} ${req.originalUrl} — ${err.message}`);
  }

  res.status(status).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && status >= 500 ? { stack: err.stack } : {}),
  });
}

/**
 * Middleware for handling 404 — route not found.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = { errorHandler, notFoundHandler };
