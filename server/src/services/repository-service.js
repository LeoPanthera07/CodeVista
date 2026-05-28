'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const simpleGit = require('simple-git');
const AdmZip = require('adm-zip');
const { run, getOne, getAll } = require('../database/db');

/** Base directory for cloned repos (resolved relative to server root) */
const REPOS_DIR = path.resolve(__dirname, '..', '..', process.env.REPOS_DIR || 'repos');
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOADS_DIR || 'uploads');

// Ensure directories exist
[REPOS_DIR, UPLOADS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * Clone a Git repository and create a database record.
 *
 * @param {string} url — HTTPS Git URL to clone
 * @returns {Promise<object>} The created repository record
 */
async function cloneRepository(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('A valid Git URL is required');
  }

  // Extract repo name from URL
  const urlParts = url.replace(/\.git$/, '').split('/');
  const name = urlParts[urlParts.length - 1] || 'unknown-repo';

  const id = uuidv4();
  const clonePath = path.join(REPOS_DIR, id);

  // Create DB record first (status = cloning)
  run(
    `INSERT INTO repositories (id, name, url, type, status) VALUES (?, ?, ?, 'git', 'cloning')`,
    [id, name, url],
  );

  try {
    console.log(`[Repo] Cloning ${url} into ${clonePath}`);
    const git = simpleGit();
    await git.clone(url, clonePath, ['--depth', '1', '--single-branch']);

    run(`UPDATE repositories SET status = 'pending', updated_at = datetime('now') WHERE id = ?`, [id]);
    console.log(`[Repo] Clone complete: ${name} (${id})`);
  } catch (err) {
    run(
      `UPDATE repositories SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
      [err.message, id],
    );
    throw new Error(`Failed to clone repository: ${err.message}`);
  }

  return getOne('SELECT * FROM repositories WHERE id = ?', [id]);
}

/**
 * Handle an uploaded archive (ZIP) and create a repository record.
 *
 * @param {object} file — multer file object { path, originalname, size }
 * @returns {object} The created repository record
 */
function uploadRepository(file) {
  if (!file) throw new Error('No file uploaded');

  const id = uuidv4();
  const name = path.basename(file.originalname, path.extname(file.originalname));
  const extractPath = path.join(REPOS_DIR, id);

  // Create DB record
  run(
    `INSERT INTO repositories (id, name, url, type, status) VALUES (?, ?, NULL, 'upload', 'pending')`,
    [id, name],
  );

  try {
    const zip = new AdmZip(file.path);
    zip.extractAllTo(extractPath, true);
    console.log(`[Repo] Extracted upload: ${name} (${id})`);

    // If the zip contains a single top-level directory, flatten it
    const entries = fs.readdirSync(extractPath);
    if (entries.length === 1) {
      const singleDir = path.join(extractPath, entries[0]);
      if (fs.statSync(singleDir).isDirectory()) {
        const innerEntries = fs.readdirSync(singleDir);
        innerEntries.forEach((entry) => {
          fs.renameSync(path.join(singleDir, entry), path.join(extractPath, entry));
        });
        fs.rmdirSync(singleDir);
      }
    }
  } catch (err) {
    run(
      `UPDATE repositories SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
      [err.message, id],
    );
    throw new Error(`Failed to extract archive: ${err.message}`);
  } finally {
    // Clean up the uploaded file
    try { fs.unlinkSync(file.path); } catch { /* ignore */ }
  }

  return getOne('SELECT * FROM repositories WHERE id = ?', [id]);
}

/**
 * Get full details for a single repository.
 *
 * @param {string} id
 * @returns {object|null}
 */
function getRepository(id) {
  const repo = getOne('SELECT * FROM repositories WHERE id = ?', [id]);
  if (!repo) return null;

  // Parse JSON fields
  if (repo.language_stats) {
    try { repo.language_stats = JSON.parse(repo.language_stats); } catch { /* leave as string */ }
  }
  return repo;
}

/**
 * List all repositories with basic stats.
 *
 * @returns {object[]}
 */
function listRepositories() {
  const repos = getAll('SELECT * FROM repositories ORDER BY created_at DESC');
  return repos.map((repo) => {
    if (repo.language_stats) {
      try { repo.language_stats = JSON.parse(repo.language_stats); } catch { /* ok */ }
    }
    return repo;
  });
}

/**
 * Delete a repository and all associated data.
 * Cascade deletes handle DB cleanup; we also remove files from disk.
 *
 * @param {string} id
 * @returns {boolean} true if deleted
 */
function deleteRepository(id) {
  const repo = getOne('SELECT * FROM repositories WHERE id = ?', [id]);
  if (!repo) return false;

  // Delete DB record (cascades to files, symbols, relationships, summaries, chat, docs)
  run('DELETE FROM repositories WHERE id = ?', [id]);

  // Delete files from disk
  const repoDir = path.join(REPOS_DIR, id);
  if (fs.existsSync(repoDir)) {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }

  console.log(`[Repo] Deleted repository: ${repo.name} (${id})`);
  return true;
}

/**
 * Get the current analysis status of a repository.
 *
 * @param {string} id
 * @returns {object|null}
 */
function getRepositoryStatus(id) {
  const repo = getOne('SELECT id, name, status, error_message, total_files, total_symbols, updated_at FROM repositories WHERE id = ?', [id]);
  if (!repo) return null;

  const fileCount = getOne('SELECT COUNT(*) as count FROM files WHERE repo_id = ?', [id]);
  const parsedCount = getOne('SELECT COUNT(*) as count FROM files WHERE repo_id = ? AND parsed = 1', [id]);
  const symbolCount = getOne('SELECT COUNT(*) as count FROM symbols WHERE repo_id = ?', [id]);

  return {
    id: repo.id,
    name: repo.name,
    status: repo.status,
    errorMessage: repo.error_message,
    totalFiles: fileCount?.count || 0,
    parsedFiles: parsedCount?.count || 0,
    totalSymbols: symbolCount?.count || 0,
    updatedAt: repo.updated_at,
  };
}

/**
 * Get the path on disk for a repository.
 *
 * @param {string} id
 * @returns {string}
 */
function getRepoPath(id) {
  return path.join(REPOS_DIR, id);
}

module.exports = {
  cloneRepository,
  uploadRepository,
  getRepository,
  listRepositories,
  deleteRepository,
  getRepositoryStatus,
  getRepoPath,
  REPOS_DIR,
};
