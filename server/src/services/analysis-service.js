'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { run, getOne, getAll, transaction, getDb } = require('../database/db');
const { parse, canParse, supportedExtensions } = require('../parsers/parser-factory');
const { getRepoPath } = require('./repository-service');
const llm = require('./llm-service');

// ── Configuration ───────────────────────────────────────────────────────────

/** Directories / files to skip when walking a repo */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', '__pycache__', '.tox',
  'dist', 'build', 'out', '.next', '.nuxt', 'coverage',
  'vendor', 'venv', '.venv', 'env', '.env', 'egg-info',
  '.idea', '.vscode', '.DS_Store',
]);

const SKIP_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'bmp', 'webp',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'mp3', 'mp4', 'wav', 'avi', 'mov',
  'zip', 'tar', 'gz', 'rar', '7z',
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'exe', 'dll', 'so', 'dylib',
  'pyc', 'pyo', 'class',
  'lock', 'map',
]);

/** Max file size to store in DB (500 KB) */
const MAX_FILE_SIZE = 500 * 1024;

// ── File Walking ────────────────────────────────────────────────────────────

/**
 * Recursively walk a directory and yield relative file paths.
 * @param {string} rootDir — Absolute path to repo root
 * @param {string} [subDir=''] — Current subdirectory (relative)
 * @returns {Array<{relativePath: string, absolutePath: string, name: string, ext: string, size: number}>}
 */
function walkFiles(rootDir, subDir = '') {
  const results = [];
  const currentDir = path.join(rootDir, subDir);
  let entries;

  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith('.') && name !== '.env.example') continue;

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      const nested = walkFiles(rootDir, path.join(subDir, name));
      results.push(...nested);
    } else if (entry.isFile()) {
      const ext = path.extname(name).slice(1).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) continue;

      const absolutePath = path.join(currentDir, name);
      let size;
      try {
        size = fs.statSync(absolutePath).size;
      } catch {
        continue;
      }
      if (size > MAX_FILE_SIZE) continue;

      results.push({
        relativePath: path.join(subDir, name),
        absolutePath,
        name,
        ext,
        size,
      });
    }
  }

  return results;
}

// ── Main Analysis Pipeline ──────────────────────────────────────────────────

/**
 * Analyse an entire repository:
 *  1. Walk files and store in DB
 *  2. Parse each supported file
 *  3. Store symbols and relationships
 *  4. Calculate language stats
 *  5. Generate summaries via LLM
 *  6. Update repo status throughout
 *
 * Runs asynchronously — caller should fire-and-forget.
 *
 * @param {string} repoId
 * @returns {Promise<void>}
 */
async function analyzeRepository(repoId) {
  const repoDir = getRepoPath(repoId);

  if (!fs.existsSync(repoDir)) {
    run(`UPDATE repositories SET status='error', error_message='Repository directory not found', updated_at=datetime('now') WHERE id=?`, [repoId]);
    throw new Error('Repository directory not found on disk');
  }

  run(`UPDATE repositories SET status='analyzing', updated_at=datetime('now') WHERE id=?`, [repoId]);

  try {
    // ─── Step 1: Walk and store files ─────────────────────────────────
    console.log(`[Analysis] Walking files for ${repoId}`);
    const fileEntries = walkFiles(repoDir);

    const insertFile = getDb().prepare(
      `INSERT INTO files (id, repo_id, path, name, extension, size, content, parsed) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    );

    const insertMany = getDb().transaction((entries) => {
      for (const entry of entries) {
        const fileId = uuidv4();
        let content = null;
        try {
          content = fs.readFileSync(entry.absolutePath, 'utf-8');
        } catch { /* binary or unreadable — skip content */ }

        insertFile.run(fileId, repoId, entry.relativePath, entry.name, entry.ext || null, entry.size, content);
      }
    });

    insertMany(fileEntries);
    console.log(`[Analysis] Stored ${fileEntries.length} files`);

    // ─── Step 2: Parse supported files ────────────────────────────────
    console.log(`[Analysis] Parsing files for ${repoId}`);
    const filesToParse = getAll(
      `SELECT id, path, name, extension, content FROM files WHERE repo_id = ? AND content IS NOT NULL`,
      [repoId],
    );

    const supported = supportedExtensions();
    let totalSymbols = 0;

    const insertSymbol = getDb().prepare(
      `INSERT INTO symbols (id, file_id, repo_id, name, type, start_line, end_line, signature, docstring, parent_symbol_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const insertRelationship = getDb().prepare(
      `INSERT INTO relationships (id, repo_id, source_symbol_id, target_symbol_id, source_file_id, target_file_id, type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const file of filesToParse) {
      if (!file.extension || !supported.has(file.extension)) continue;

      let result;
      try {
        result = parse(file.content, file.extension, file.path);
      } catch (err) {
        console.warn(`[Analysis] Parse error for ${file.path}: ${err.message}`);
        continue;
      }

      if (result.errors.length > 0) {
        console.warn(`[Analysis] ${result.errors.length} error(s) in ${file.path}`);
      }

      // Store symbols in a transaction
      const symbolIdMap = {}; // name -> id, for parent linking

      const storeSymbols = getDb().transaction(() => {
        for (const sym of result.symbols) {
          const symId = uuidv4();
          const parentId = sym.parentName ? symbolIdMap[sym.parentName] || null : null;

          insertSymbol.run(
            symId,
            file.id,
            repoId,
            sym.name,
            sym.type,
            sym.startLine || null,
            sym.endLine || null,
            sym.signature || null,
            sym.docstring || null,
            parentId,
            sym.metadata ? JSON.stringify(sym.metadata) : null,
          );

          symbolIdMap[sym.name] = symId;
          totalSymbols++;
        }

        // Store import relationships (file → file)
        for (const imp of result.imports) {
          if (!imp.source) continue;
          // Try to resolve the import to a file in the repo
          const targetFile = resolveImport(imp.source, file.path, repoId);
          if (targetFile) {
            insertRelationship.run(
              uuidv4(),
              repoId,
              null,
              null,
              file.id,
              targetFile.id,
              'import',
            );
          }
        }

        // Mark file as parsed
        run(`UPDATE files SET parsed = 1 WHERE id = ?`, [file.id]);
      });

      storeSymbols();
    }

    console.log(`[Analysis] Extracted ${totalSymbols} symbols`);

    // ─── Step 3: Calculate language stats ─────────────────────────────
    const langRows = getAll(
      `SELECT extension, COUNT(*) as count FROM files WHERE repo_id = ? AND extension IS NOT NULL GROUP BY extension ORDER BY count DESC`,
      [repoId],
    );
    const languageStats = {};
    langRows.forEach((r) => { languageStats[r.extension] = r.count; });

    run(
      `UPDATE repositories SET language_stats = ?, total_files = ?, total_symbols = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(languageStats), fileEntries.length, totalSymbols, repoId],
    );

    // ─── Step 4: Generate summaries via LLM (best-effort) ────────────
    await generateAllSummaries(repoId);

    // ─── Done ─────────────────────────────────────────────────────────
    run(`UPDATE repositories SET status = 'ready', updated_at = datetime('now') WHERE id = ?`, [repoId]);
    console.log(`[Analysis] Complete for ${repoId}`);
  } catch (err) {
    console.error(`[Analysis] Failed for ${repoId}:`, err);
    run(
      `UPDATE repositories SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
      [err.message, repoId],
    );
  }
}

/**
 * Attempt to resolve an import source to a file record in the DB.
 * @param {string} source   — Import source (e.g. './utils', 'express')
 * @param {string} fromPath — Path of the importing file
 * @param {string} repoId
 * @returns {object|null}
 */
function resolveImport(source, fromPath, repoId) {
  // Only resolve relative imports
  if (!source.startsWith('.')) return null;

  const dir = path.dirname(fromPath);
  const resolved = path.normalize(path.join(dir, source));

  // Try exact match, then with extensions
  const candidates = [
    resolved,
    resolved + '.js',
    resolved + '.ts',
    resolved + '.jsx',
    resolved + '.tsx',
    resolved + '.py',
    path.join(resolved, 'index.js'),
    path.join(resolved, 'index.ts'),
  ];

  for (const candidate of candidates) {
    const file = getOne('SELECT id, path FROM files WHERE repo_id = ? AND path = ?', [repoId, candidate]);
    if (file) return file;
  }

  return null;
}

// ── Summary Generation ──────────────────────────────────────────────────────

/**
 * Generate file-level, module-level, and repo-level summaries via LLM.
 * Failures are logged but do not abort the pipeline.
 *
 * @param {string} repoId
 */
async function generateAllSummaries(repoId) {
  const repo = getOne('SELECT * FROM repositories WHERE id = ?', [repoId]);
  if (!repo) return;

  const user = getOne(
    `SELECT u.groq_api_key FROM users u
     JOIN repositories r ON r.user_id = u.id
     WHERE r.id = ?`,
    [repoId]
  );
  const opts = { apiKey: user?.groq_api_key || undefined };

  // ── File-level summaries (for key files only to avoid API overload) ──
  const keyFiles = getAll(
    `SELECT f.id, f.path, f.name, f.content, f.extension
     FROM files f
     WHERE f.repo_id = ? AND f.parsed = 1 AND f.content IS NOT NULL
     ORDER BY f.size DESC
     LIMIT 20`,
    [repoId],
  );

  console.log(`[Analysis] Generating summaries for ${keyFiles.length} key files`);

  for (const file of keyFiles) {
    try {
      const symbols = getAll(
        `SELECT name, type, signature, start_line, end_line FROM symbols WHERE file_id = ?`,
        [file.id],
      );

      const context = `File: ${file.path}\n\nSymbols:\n${symbols.map((s) => `- ${s.type}: ${s.signature || s.name}`).join('\n')}\n\nSource (first 200 lines):\n${(file.content || '').split('\n').slice(0, 200).join('\n')}`;

      const summary = await llm.generateSummary(context, 'file', file.path, opts);
      run(
        `INSERT INTO summaries (id, repo_id, level, target_id, target_name, content) VALUES (?, ?, 'file', ?, ?, ?)`,
        [uuidv4(), repoId, file.id, file.path, summary],
      );
    } catch (err) {
      console.warn(`[Analysis] Summary failed for ${file.path}: ${err.message}`);
    }
  }

  // ── Module-level summaries (by directory) ─────────────────────────────
  const dirs = getAll(
    `SELECT DISTINCT
       CASE
         WHEN instr(path, '/') > 0 THEN substr(path, 1, instr(path, '/') - 1)
         ELSE '.'
       END as dir_name
     FROM files WHERE repo_id = ?`,
    [repoId],
  );

  for (const { dir_name } of dirs) {
    try {
      const fileSummaries = getAll(
        `SELECT s.target_name, s.content
         FROM summaries s
         JOIN files f ON s.target_id = f.id
         WHERE s.repo_id = ? AND s.level = 'file' AND f.path LIKE ?`,
        [repoId, dir_name === '.' ? '%' : `${dir_name}/%`],
      );

      if (fileSummaries.length === 0) continue;

      const context = fileSummaries.map((s) => `${s.target_name}: ${s.content}`).join('\n\n');
      const summary = await llm.generateSummary(context, 'module', dir_name, opts);
      run(
        `INSERT INTO summaries (id, repo_id, level, target_id, target_name, content) VALUES (?, ?, 'module', NULL, ?, ?)`,
        [uuidv4(), repoId, dir_name, summary],
      );
    } catch (err) {
      console.warn(`[Analysis] Module summary failed for ${dir_name}: ${err.message}`);
    }
  }

  // ── Repository-level summary ──────────────────────────────────────────
  try {
    const allSummaries = getAll(
      `SELECT level, target_name, content FROM summaries WHERE repo_id = ? ORDER BY level`,
      [repoId],
    );
    const fileTree = buildFileTreeString(repoId);
    const context = `File tree:\n${fileTree}\n\nSummaries:\n${allSummaries.map((s) => `[${s.level}] ${s.target_name}: ${s.content}`).join('\n\n')}`;

    const summary = await llm.generateSummary(context, 'repository', repo.name, opts);
    run(
      `INSERT INTO summaries (id, repo_id, level, target_id, target_name, content) VALUES (?, ?, 'repository', NULL, ?, ?)`,
      [uuidv4(), repoId, repo.name, summary],
    );
  } catch (err) {
    console.warn(`[Analysis] Repo summary failed: ${err.message}`);
  }
}

// ── Query functions ─────────────────────────────────────────────────────────

/**
 * Build a hierarchical file tree for a repository.
 *
 * @param {string} repoId
 * @returns {object} Nested tree structure: { name, type, children, ... }
 */
function getFileTree(repoId) {
  const files = getAll(
    `SELECT id, path, name, extension, size, parsed FROM files WHERE repo_id = ? ORDER BY path`,
    [repoId],
  );

  const root = { name: '/', type: 'directory', children: [] };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        current.children.push({
          id: file.id,
          name: part,
          type: 'file',
          extension: file.extension,
          size: file.size,
          parsed: !!file.parsed,
          path: file.path,
        });
      } else {
        let dir = current.children.find((c) => c.name === part && c.type === 'directory');
        if (!dir) {
          dir = { name: part, type: 'directory', children: [] };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

  return root;
}

/**
 * Build a flat string representation of the file tree (for LLM context).
 * @param {string} repoId
 * @returns {string}
 */
function buildFileTreeString(repoId) {
  const files = getAll(`SELECT path FROM files WHERE repo_id = ? ORDER BY path`, [repoId]);
  return files.map((f) => f.path).join('\n');
}

/**
 * Get file details including content and symbols.
 *
 * @param {string} repoId
 * @param {string} fileId
 * @returns {object|null}
 */
function getFileDetails(repoId, fileId) {
  const file = getOne(
    `SELECT * FROM files WHERE id = ? AND repo_id = ?`,
    [fileId, repoId],
  );
  if (!file) return null;

  const symbols = getAll(
    `SELECT * FROM symbols WHERE file_id = ? ORDER BY start_line`,
    [fileId],
  );

  // Parse metadata JSON
  symbols.forEach((s) => {
    if (s.metadata) {
      try { s.metadata = JSON.parse(s.metadata); } catch { /* ok */ }
    }
  });

  const summary = getOne(
    `SELECT content FROM summaries WHERE repo_id = ? AND target_id = ? AND level = 'file'`,
    [repoId, fileId],
  );

  return {
    ...file,
    symbols,
    summary: summary?.content || null,
  };
}

/**
 * Get the dependency/structure map (nodes and edges) for a repository.
 *
 * @param {string} repoId
 * @returns {{ nodes: object[], edges: object[] }}
 */
function getRepositoryMap(repoId) {
  // Nodes: files with their symbol counts
  const files = getAll(
    `SELECT f.id, f.path, f.name, f.extension,
            (SELECT COUNT(*) FROM symbols s WHERE s.file_id = f.id) as symbol_count
     FROM files f WHERE f.repo_id = ?`,
    [repoId],
  );

  const nodes = files.map((f) => ({
    id: f.id,
    label: f.name,
    path: f.path,
    extension: f.extension,
    symbolCount: f.symbol_count,
    type: 'file',
  }));

  // Edges: relationships (imports between files)
  const rels = getAll(
    `SELECT source_file_id, target_file_id, type FROM relationships WHERE repo_id = ? AND source_file_id IS NOT NULL AND target_file_id IS NOT NULL`,
    [repoId],
  );

  const edges = rels.map((r) => ({
    source: r.source_file_id,
    target: r.target_file_id,
    type: r.type,
  }));

  return { nodes, edges };
}

/**
 * Get multi-level summaries for a repository.
 *
 * @param {string} repoId
 * @returns {{ file: object[], module: object[], repository: object[] }}
 */
function getRepositorySummaries(repoId) {
  const all = getAll(
    `SELECT * FROM summaries WHERE repo_id = ? ORDER BY level, target_name`,
    [repoId],
  );

  return {
    file: all.filter((s) => s.level === 'file'),
    module: all.filter((s) => s.level === 'module'),
    repository: all.filter((s) => s.level === 'repository'),
  };
}

module.exports = {
  analyzeRepository,
  getFileTree,
  getFileDetails,
  getRepositoryMap,
  getRepositorySummaries,
};
