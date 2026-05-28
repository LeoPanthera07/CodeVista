'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { run, getOne } = require('../database/db');
const { hashPassword, verifyPassword } = require('../utils/auth-helpers');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user and return JWT
 */
router.post('/signup', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();

  if (!trimmedEmail.includes('@')) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
  }

  if (trimmedPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
  }

  try {
    // Check if user already exists
    const existingUser = getOne('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    const userId = uuidv4();
    const hashedPassword = hashPassword(trimmedPassword);

    // Save user to database
    run(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [userId, trimmedEmail, hashedPassword]
    );

    // Generate JWT
    const token = jwt.sign({ id: userId, email: trimmedEmail }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        email: trimmedEmail,
        groq_api_key: null,
      },
    });
  } catch (error) {
    console.error('[Auth] Signup error:', error);
    res.status(500).json({ success: false, error: 'Server error during registration' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();

  try {
    // Find user
    const user = getOne('SELECT * FROM users WHERE email = ?', [trimmedEmail]);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Verify password
    const isMatch = verifyPassword(trimmedPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        groq_api_key: user.groq_api_key,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * @route   PUT /api/auth/key
 * @desc    Update user's custom Groq API key
 * @access  Private
 */
router.put('/key', authenticateToken, (req, res) => {
  const { groq_api_key } = req.body;
  
  // If undefined/null or empty string, we set to null
  const apiKey = groq_api_key && groq_api_key.trim() ? groq_api_key.trim() : null;

  try {
    run(
      'UPDATE users SET groq_api_key = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [apiKey, req.user.id]
    );

    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        groq_api_key: apiKey,
      },
    });
  } catch (error) {
    console.error('[Auth] Update API key error:', error);
    res.status(500).json({ success: false, error: 'Server error updating API key' });
  }
});

module.exports = router;
