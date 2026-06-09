'use strict';

/**
 * Initializes the CodeVista database schema.
 * Creates all tables and indexes if they do not already exist.
 * @param {import('better-sqlite3').Database} db
 */
function initializeSchema(db) {
  db.exec(`
    -- ════════════════════════════════════════════════════════════
    -- Users
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      email           TEXT UNIQUE NOT NULL,
      password_hash   TEXT NOT NULL,
      groq_api_key    TEXT,
      github_username   TEXT,
      github_token      TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ════════════════════════════════════════════════════════════
    -- Repositories
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS repositories (
      id              TEXT PRIMARY KEY,
      user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      url             TEXT,
      type            TEXT NOT NULL CHECK(type IN ('git','upload')),
      status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','cloning','analyzing','ready','error')),
      error_message   TEXT,
      language_stats  TEXT,            -- JSON: { "js": 42, "py": 18, ... }
      total_files     INTEGER DEFAULT 0,
      total_symbols   INTEGER DEFAULT 0,
      is_verified_owner INTEGER DEFAULT 0,
      github_username   TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ════════════════════════════════════════════════════════════
    -- Files
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS files (
      id          TEXT PRIMARY KEY,
      repo_id     TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      path        TEXT NOT NULL,       -- relative path inside repo
      name        TEXT NOT NULL,       -- basename
      extension   TEXT,                -- e.g. "js", "py"
      size        INTEGER DEFAULT 0,
      content     TEXT,                -- full source code
      parsed      INTEGER DEFAULT 0,  -- boolean flag
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_files_repo   ON files(repo_id);
    CREATE INDEX IF NOT EXISTS idx_files_ext    ON files(extension);

    -- ════════════════════════════════════════════════════════════
    -- Symbols (functions, classes, variables, routes, etc.)
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS symbols (
      id                TEXT PRIMARY KEY,
      file_id           TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      repo_id           TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      name              TEXT NOT NULL,
      type              TEXT NOT NULL,   -- function, class, method, variable, import, export, route, component
      start_line        INTEGER,
      end_line          INTEGER,
      signature         TEXT,            -- e.g. "function add(a, b)"
      docstring         TEXT,
      parent_symbol_id  TEXT REFERENCES symbols(id) ON DELETE SET NULL,
      metadata          TEXT             -- JSON for extra info (decorators, params, etc.)
    );
    CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
    CREATE INDEX IF NOT EXISTS idx_symbols_repo ON symbols(repo_id);
    CREATE INDEX IF NOT EXISTS idx_symbols_type ON symbols(type);

    -- ════════════════════════════════════════════════════════════
    -- Relationships (imports, calls, extends, etc.)
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS relationships (
      id                TEXT PRIMARY KEY,
      repo_id           TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      source_symbol_id  TEXT REFERENCES symbols(id) ON DELETE CASCADE,
      target_symbol_id  TEXT REFERENCES symbols(id) ON DELETE CASCADE,
      source_file_id    TEXT REFERENCES files(id) ON DELETE CASCADE,
      target_file_id    TEXT REFERENCES files(id) ON DELETE CASCADE,
      type              TEXT NOT NULL    -- import, extends, implements, calls, uses
    );
    CREATE INDEX IF NOT EXISTS idx_rel_repo ON relationships(repo_id);

    -- ════════════════════════════════════════════════════════════
    -- Summaries (file-level, module-level, repo-level)
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS summaries (
      id          TEXT PRIMARY KEY,
      repo_id     TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      level       TEXT NOT NULL CHECK(level IN ('file','module','repository')),
      target_id   TEXT,                -- file id or null for repo-level
      target_name TEXT,
      content     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_summaries_repo ON summaries(repo_id);

    -- ════════════════════════════════════════════════════════════
    -- Chat Messages
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS chat_messages (
      id          TEXT PRIMARY KEY,
      repo_id     TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      role        TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content     TEXT NOT NULL,
      "references" TEXT,                -- JSON array of { fileId, symbolName, line }
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_repo ON chat_messages(repo_id);

    -- ════════════════════════════════════════════════════════════
    -- Generated Documentation
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS documentation (
      id          TEXT PRIMARY KEY,
      repo_id     TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,       -- readme, onboarding, architecture, module
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_docs_repo ON documentation(repo_id);
  `);

  // Schema evolution / migrations for GitHub verification columns
  try {
    db.exec(`ALTER TABLE users ADD COLUMN github_username TEXT;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN github_token TEXT;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE repositories ADD COLUMN is_verified_owner INTEGER DEFAULT 0;`);
  } catch (e) { /* already exists */ }
  try {
    db.exec(`ALTER TABLE repositories ADD COLUMN github_username TEXT;`);
  } catch (e) { /* already exists */ }

  console.log('[DB] Schema initialized');
}

module.exports = { initializeSchema };
