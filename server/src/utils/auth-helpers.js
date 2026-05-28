'use strict';

const crypto = require('crypto');

/**
 * Generates a secure PBKDF2 hash of a password.
 * @param {string} password
 * @returns {string} salt:hash format
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored PBKDF2 hash.
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean} true if matches
 */
function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return verifyHash === hash;
}

module.exports = {
  hashPassword,
  verifyPassword,
};
