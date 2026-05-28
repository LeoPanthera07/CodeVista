'use strict';

const { v4: uuidv4 } = require('uuid');
const { run, getOne, getAll } = require('../database/db');
const llm = require('./llm-service');

/**
 * Process a user message: store it, build context, get LLM answer, store reply.
 *
 * @param {string} repoId  — Repository to chat about
 * @param {string} message — User's question
 * @returns {Promise<object>} The assistant message record
 */
async function sendMessage(repoId, message) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('Message cannot be empty');
  }

  const repo = getOne('SELECT * FROM repositories WHERE id = ?', [repoId]);
  if (!repo) throw new Error('Repository not found');

  // Store user message
  const userMsgId = uuidv4();
  run(
    `INSERT INTO chat_messages (id, repo_id, role, content) VALUES (?, ?, 'user', ?)`,
    [userMsgId, repoId, message.trim()],
  );

  // Build repository context
  const repoContext = buildChatContext(repoId, message);

  // Get chat history (last 10 messages for context)
  const history = getAll(
    `SELECT role, content FROM chat_messages WHERE repo_id = ? ORDER BY created_at DESC LIMIT 10`,
    [repoId],
  ).reverse();

  // Remove the message we just inserted from history to avoid duplication
  const filteredHistory = history.filter((m) => !(m.role === 'user' && m.content === message.trim()));

  // Get LLM answer
  const { answer, references } = await llm.answerQuestion(message, repoContext, filteredHistory);

  // Store assistant reply
  const assistantMsgId = uuidv4();
  run(
    `INSERT INTO chat_messages (id, repo_id, role, content, "references") VALUES (?, ?, 'assistant', ?, ?)`,
    [assistantMsgId, repoId, answer, JSON.stringify(references)],
  );

  return {
    id: assistantMsgId,
    repoId,
    role: 'assistant',
    content: answer,
    references,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build relevant context for a chat question by searching symbols and summaries.
 *
 * @param {string} repoId
 * @param {string} question
 * @returns {string}
 */
function buildChatContext(repoId, question) {
  const parts = [];

  // Repository summary
  const repoSummary = getOne(
    `SELECT content FROM summaries WHERE repo_id = ? AND level = 'repository' LIMIT 1`,
    [repoId],
  );
  if (repoSummary) {
    parts.push(`=== REPOSITORY OVERVIEW ===\n${repoSummary.content}`);
  }

  // File tree
  const files = getAll(`SELECT path, name, extension FROM files WHERE repo_id = ? ORDER BY path`, [repoId]);
  if (files.length) {
    parts.push('=== FILE TREE ===\n' + files.map((f) => f.path).join('\n'));
  }

  // Extract keywords from question for targeted context
  const keywords = question
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Search for relevant symbols
  const allSymbols = getAll(
    `SELECT s.name, s.type, s.signature, s.start_line, s.end_line, s.docstring, f.path as file_path
     FROM symbols s JOIN files f ON s.file_id = f.id
     WHERE s.repo_id = ?
     ORDER BY s.type, s.name`,
    [repoId],
  );

  // Relevance-score symbols based on keyword matches
  const scoredSymbols = allSymbols.map((s) => {
    let score = 0;
    const name = (s.name || '').toLowerCase();
    const sig = (s.signature || '').toLowerCase();
    const filePath = (s.file_path || '').toLowerCase();

    for (const kw of keywords) {
      if (name.includes(kw)) score += 3;
      if (sig.includes(kw)) score += 2;
      if (filePath.includes(kw)) score += 1;
    }
    return { ...s, score };
  });

  // Take the top 50 most relevant symbols
  const relevant = scoredSymbols
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  if (relevant.length) {
    parts.push(
      '=== RELEVANT SYMBOLS ===\n' +
        relevant
          .map((s) => `${s.file_path} | ${s.type}: ${s.signature || s.name} (L${s.start_line || '?'}-${s.end_line || '?'})${s.docstring ? ' — ' + s.docstring.slice(0, 100) : ''}`)
          .join('\n'),
    );
  }

  // Include file summaries
  const fileSummaries = getAll(
    `SELECT target_name, content FROM summaries WHERE repo_id = ? AND level = 'file'`,
    [repoId],
  );
  if (fileSummaries.length) {
    parts.push(
      '=== FILE SUMMARIES ===\n' +
        fileSummaries.map((s) => `${s.target_name}: ${s.content}`).join('\n\n'),
    );
  }

  // Include source code of most relevant files (limited)
  const relevantFiles = new Set(relevant.slice(0, 5).map((s) => s.file_path));
  for (const fp of relevantFiles) {
    const file = getOne(
      `SELECT content FROM files WHERE repo_id = ? AND path = ?`,
      [repoId, fp],
    );
    if (file?.content) {
      const lines = file.content.split('\n').slice(0, 100).join('\n');
      parts.push(`=== SOURCE: ${fp} ===\n${lines}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Get chat history for a repository.
 *
 * @param {string} repoId
 * @param {number} [limit=50]
 * @returns {object[]}
 */
function getChatHistory(repoId, limit = 50) {
  const messages = getAll(
    `SELECT * FROM chat_messages WHERE repo_id = ? ORDER BY created_at ASC LIMIT ?`,
    [repoId, limit],
  );

  return messages.map((m) => {
    if (m.references) {
      try { m.references = JSON.parse(m.references); } catch { /* ok */ }
    }
    return m;
  });
}

/**
 * Clear all chat history for a repository.
 *
 * @param {string} repoId
 * @returns {{ deleted: number }}
 */
function clearHistory(repoId) {
  const result = run(`DELETE FROM chat_messages WHERE repo_id = ?`, [repoId]);
  return { deleted: result.changes };
}

module.exports = { sendMessage, getChatHistory, clearHistory };
