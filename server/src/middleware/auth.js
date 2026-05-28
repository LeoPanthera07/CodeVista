'use strict';

const jwt = require('jsonwebtoken');
const { getOne } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'codevista-super-secret-key-135';

/**
 * Middleware to authenticate requests using JWT.
 * Verifies token, fetches full user profile from SQLite, and populates req.user.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token is required (Authorization: Bearer <token>)' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch full user record including custom Groq key
    const user = getOne('SELECT id, email, groq_api_key FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'User account not found or has been disabled' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'Session expired or authentication token is invalid' });
  }
}

/**
 * Middleware to verify that the repository being accessed belongs to the authenticated user.
 */
function verifyRepoOwnership(req, res, next) {
  const repoId = req.params.id || req.params.repoId;
  if (!repoId) {
    return next();
  }

  try {
    const repo = getOne('SELECT user_id FROM repositories WHERE id = ?', [repoId]);
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    if (repo.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You do not have permission to access this repository' });
    }

    next();
  } catch (error) {
    console.error('[Auth] verifyRepoOwnership error:', error);
    res.status(500).json({ success: false, error: 'Server error verifying repository permission' });
  }
}

module.exports = {
  authenticateToken,
  verifyRepoOwnership,
  JWT_SECRET,
};
