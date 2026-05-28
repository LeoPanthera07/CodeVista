'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { initializeSchema } = require('./schema');

/** @type {Database.Database | null} */
let _db = null;

/**
 * Path to the SQLite database file.
 * Resolves relative to the server root directory.
 */
const DB_DIR = path.resolve(__dirname, '..', '..', process.env.DATA_DIR || 'data');
const DB_PATH = path.join(DB_DIR, 'codevista.db');

/**
 * Returns the singleton database connection, creating it on first call.
 * Enables WAL mode and foreign keys for performance and integrity.
 * @returns {Database.Database} The better-sqlite3 database instance
 */
function getDb() {
  if (_db) return _db;

  const fs = require('fs');
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);

  // Performance & integrity pragmas
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');

  initializeSchema(_db);

  console.log(`[DB] Connected to SQLite at ${DB_PATH}`);
  return _db;
}

/**
 * Closes the database connection gracefully.
 * Should be called during application shutdown.
 */
function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
    console.log('[DB] Connection closed');
  }
}

// ─── Generic Query Helpers ───────────────────────────────────────────────────

/**
 * Execute an INSERT / UPDATE / DELETE statement.
 * @param {string} sql  — SQL string with ? placeholders
 * @param {any[]}  [params=[]] — Bind parameters
 * @returns {Database.RunResult} { changes, lastInsertRowid }
 */
function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

/**
 * Fetch a single row.
 * @param {string} sql
 * @param {any[]}  [params=[]]
 * @returns {object|undefined}
 */
function getOne(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

/**
 * Fetch all matching rows.
 * @param {string} sql
 * @param {any[]}  [params=[]]
 * @returns {object[]}
 */
function getAll(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

/**
 * Run multiple statements inside a single transaction (atomic).
 * @param {function} fn — Receives the db instance; return value is forwarded.
 * @returns {any}
 */
function transaction(fn) {
  const wrapped = getDb().transaction(fn);
  return wrapped();
}

module.exports = { getDb, closeDb, run, getOne, getAll, transaction, DB_PATH };
