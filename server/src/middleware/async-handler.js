'use strict';

/**
 * Wraps an async route handler so rejected promises are forwarded to Express error handling.
 *
 * @param {function} fn — Async (req, res, next) => Promise<void>
 * @returns {function}
 *
 * @example
 *   router.get('/items', asyncHandler(async (req, res) => {
 *     const items = await getItems();
 *     res.json({ success: true, data: items });
 *   }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
