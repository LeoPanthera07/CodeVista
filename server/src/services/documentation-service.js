'use strict';

const { v4: uuidv4 } = require('uuid');
const { run, getOne, getAll } = require('../database/db');
const llm = require('./llm-service');

/**
 * Generate documentation for a repository.
 *
 * @param {string} repoId
 * @param {'readme'|'onboarding'|'architecture'|'module'} type
 * @param {string} [customApiKey] — Optional custom user API key
 * @returns {Promise<object>} The documentation record
 */
async function generateDocumentation(repoId, type, customApiKey) {
  const validTypes = ['readme', 'onboarding', 'architecture', 'module'];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid documentation type. Must be one of: ${validTypes.join(', ')}`);
  }

  const repo = getOne('SELECT * FROM repositories WHERE id = ?', [repoId]);
  if (!repo) throw new Error('Repository not found');

  // Build context from repo data
  const context = buildDocContext(repoId, repo.name);

  // Generate via LLM
  const content = await llm.generateDocumentation(context, type, repo.name, { apiKey: customApiKey });

  const titleMap = {
    readme: `README — ${repo.name}`,
    onboarding: `Developer Onboarding Guide — ${repo.name}`,
    architecture: `Architecture Document — ${repo.name}`,
    module: `Module Documentation — ${repo.name}`,
  };

  const id = uuidv4();
  run(
    `INSERT INTO documentation (id, repo_id, type, title, content) VALUES (?, ?, ?, ?, ?)`,
    [id, repoId, type, titleMap[type], content],
  );

  return {
    id,
    repoId,
    type,
    title: titleMap[type],
    content,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build context for documentation generation from repository data.
 *
 * @param {string} repoId
 * @param {string} repoName
 * @returns {string}
 */
function buildDocContext(repoId, repoName) {
  const parts = [`Project: ${repoName}`];

  // File tree
  const files = getAll(`SELECT path, name, extension, size FROM files WHERE repo_id = ? ORDER BY path`, [repoId]);
  if (files.length) {
    parts.push('=== FILE STRUCTURE ===\n' + files.map((f) => `${f.path} (${f.size} bytes)`).join('\n'));
  }

  // Language stats
  const repo = getOne('SELECT language_stats FROM repositories WHERE id = ?', [repoId]);
  if (repo?.language_stats) {
    let stats = repo.language_stats;
    if (typeof stats === 'string') {
      try { stats = JSON.parse(stats); } catch { stats = null; }
    }
    if (stats) {
      parts.push('=== LANGUAGE STATS ===\n' + Object.entries(stats).map(([ext, count]) => `.${ext}: ${count} files`).join('\n'));
    }
  }

  // Summaries
  const summaries = getAll(
    `SELECT level, target_name, content FROM summaries WHERE repo_id = ? ORDER BY level`,
    [repoId],
  );
  if (summaries.length) {
    parts.push(
      '=== SUMMARIES ===\n' +
        summaries.map((s) => `[${s.level}] ${s.target_name}: ${s.content}`).join('\n\n'),
    );
  }

  // Key symbols (functions, classes, routes, components)
  const symbols = getAll(
    `SELECT s.name, s.type, s.signature, f.path as file_path
     FROM symbols s JOIN files f ON s.file_id = f.id
     WHERE s.repo_id = ? AND s.type IN ('function', 'class', 'route', 'component')
     ORDER BY s.type, s.name LIMIT 100`,
    [repoId],
  );
  if (symbols.length) {
    parts.push(
      '=== KEY SYMBOLS ===\n' +
        symbols.map((s) => `${s.type}: ${s.signature || s.name} (${s.file_path})`).join('\n'),
    );
  }

  // Package.json / requirements.txt content
  const pkgFiles = getAll(
    `SELECT path, content FROM files WHERE repo_id = ? AND name IN ('package.json', 'requirements.txt', 'setup.py', 'pyproject.toml', 'Cargo.toml')`,
    [repoId],
  );
  for (const pf of pkgFiles) {
    if (pf.content) {
      parts.push(`=== ${pf.path} ===\n${pf.content.slice(0, 2000)}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * List all generated documentation for a repository.
 *
 * @param {string} repoId
 * @returns {object[]}
 */
function getDocumentation(repoId) {
  return getAll(
    `SELECT id, repo_id, type, title, created_at FROM documentation WHERE repo_id = ? ORDER BY created_at DESC`,
    [repoId],
  );
}

/**
 * Get a single documentation record by ID.
 *
 * @param {string} repoId
 * @param {string} docId
 * @returns {object|null}
 */
function getDocumentationById(repoId, docId) {
  return getOne(
    `SELECT * FROM documentation WHERE id = ? AND repo_id = ?`,
    [docId, repoId],
  );
}

module.exports = { generateDocumentation, getDocumentation, getDocumentationById };
