'use strict';

const Groq = require('groq-sdk');

const MODEL = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';
const MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '4096', 10);
const TEMPERATURE = parseFloat(process.env.LLM_TEMPERATURE || '0.3');

/** @type {Groq | null} */
let _client = null;

/**
 * Get (or lazily create) the singleton Groq client.
 * @returns {Groq}
 */
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set');
  }
  _client = new Groq({ apiKey });
  return _client;
}

// ── Rate-limit helpers (simple token-bucket per minute) ─────────────────────
const RPM = parseInt(process.env.LLM_RATE_LIMIT_RPM || '30', 10);
let _tokens = RPM;
let _lastRefill = Date.now();

/**
 * Wait until a rate-limit token is available.
 * @returns {Promise<void>}
 */
async function acquireToken() {
  const now = Date.now();
  const elapsed = now - _lastRefill;
  if (elapsed >= 60_000) {
    _tokens = RPM;
    _lastRefill = now;
  }
  if (_tokens > 0) {
    _tokens--;
    return;
  }
  // Wait until the bucket refills
  const waitMs = 60_000 - elapsed + 100;
  console.log(`[LLM] Rate limit reached — waiting ${Math.round(waitMs / 1000)}s`);
  await new Promise((r) => setTimeout(r, waitMs));
  _tokens = RPM - 1;
  _lastRefill = Date.now();
}

// ── Core chat completion wrapper ────────────────────────────────────────────

/**
 * Send a chat completion request to Groq.
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [opts]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.temperature]
 * @param {string} [opts.model]
 * @returns {Promise<string>} The assistant's reply text
 */
async function chatCompletion(messages, opts = {}) {
  await acquireToken();

  let client;
  if (opts.apiKey) {
    client = new Groq({ apiKey: opts.apiKey });
  } else {
    client = getClient();
  }

  const response = await client.chat.completions.create({
    model: opts.model || MODEL,
    messages,
    max_tokens: opts.maxTokens || MAX_TOKENS,
    temperature: opts.temperature ?? TEMPERATURE,
  });

  const choice = response.choices?.[0];
  if (!choice || !choice.message) {
    throw new Error('Empty response from Groq API');
  }
  return choice.message.content;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a summary at the given level using LLM.
 *
 * @param {string} context     — Code / symbol context to summarize
 * @param {'file'|'module'|'repository'} level
 * @param {string} targetName  — Filename, module name, or repo name
 * @returns {Promise<string>}
 */
async function generateSummary(context, level, targetName, opts = {}) {
  const prompts = {
    file: `You are an expert code analyst. Provide a clear, concise summary of the following source file "${targetName}".
Describe:
- The file's primary purpose and responsibility
- Key functions, classes, and exports
- Important dependencies and relationships
- Any patterns or frameworks used

Be specific and technical. Write 3-6 sentences.

Source code and symbols:
${truncate(context, 12000)}`,

    module: `You are an expert code analyst. Summarize the following module/directory "${targetName}".
Describe:
- The module's overall responsibility
- How the files within it relate to each other
- Key abstractions and interfaces exposed
- Design patterns used

Write a clear 4-8 sentence summary.

Files and summaries in this module:
${truncate(context, 12000)}`,

    repository: `You are an expert code analyst. Provide a comprehensive summary of the repository "${targetName}".
Describe:
- The project's purpose and what problem it solves
- Architecture and tech stack
- Key modules and how they interact
- Entry points and main workflows
- Code quality observations

Write a thorough 6-12 sentence summary.

Repository structure and module summaries:
${truncate(context, 14000)}`,
  };

  const systemMsg = 'You are a senior software engineer providing precise, technical code summaries. Be factual and specific — never guess.';
  const userMsg = prompts[level] || prompts.file;

  return chatCompletion([
    { role: 'system', content: systemMsg },
    { role: 'user', content: userMsg },
  ], opts);
}

/**
 * Answer a user question about a codebase with code references.
 *
 * @param {string} question      — The user's natural-language question
 * @param {string} repoContext   — Relevant code, symbols, summaries
 * @param {Array<{role: string, content: string}>} chatHistory — Previous messages
 * @returns {Promise<{answer: string, references: object[]}>}
 */
async function answerQuestion(question, repoContext, chatHistory = [], opts = {}) {
  const systemMsg = `You are CodeVista, an AI assistant that helps developers understand codebases.
You have access to the repository's code, symbols, and summaries provided below.

RULES:
- Answer questions accurately based on the code context provided
- Reference specific files, functions, and line numbers when possible
- If you are unsure, say so — never fabricate code references
- Format code references as: \`filename:function_name\` (line X-Y)
- Use markdown formatting for readability
- When showing code, use fenced code blocks with language tags

REPOSITORY CONTEXT:
${truncate(repoContext, 14000)}`;

  const messages = [
    { role: 'system', content: systemMsg },
    ...chatHistory.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: question },
  ];

  const answer = await chatCompletion(messages, opts);

  // Extract references from the answer (best-effort pattern matching)
  const references = extractReferences(answer);

  return { answer, references };
}

/**
 * Generate documentation for a repository.
 *
 * @param {string} repoContext  — Code summaries, file tree, symbols
 * @param {string} docType      — readme | onboarding | architecture | module
 * @param {string} repoName
 * @returns {Promise<string>}
 */
async function generateDocumentation(repoContext, docType, repoName, opts = {}) {
  const typePrompts = {
    readme: `Generate a professional README.md for the project "${repoName}".
Include:
- Project title and description
- Key features
- Tech stack
- Getting started (installation, configuration, running)
- Project structure overview
- API endpoints (if applicable)
- Contributing guidelines placeholder
- License placeholder

Use markdown formatting.`,

    onboarding: `Generate a developer onboarding guide for "${repoName}".
Include:
- Project overview and architecture
- Development environment setup
- Key concepts and terminology
- Directory structure walkthrough
- Common development workflows
- Code conventions and patterns used
- Where to find things (entry points, config, tests)
- Tips for new contributors`,

    architecture: `Generate an architecture document for "${repoName}".
Include:
- System overview and design philosophy
- High-level architecture diagram description
- Component/module breakdown
- Data flow and request lifecycle
- Key design patterns and decisions
- External dependencies and integrations
- Security considerations
- Scalability notes`,

    module: `Generate module-level documentation for "${repoName}".
For each major module/directory, provide:
- Module purpose and responsibility
- Public API / exported interfaces
- Internal structure
- Dependencies on other modules
- Usage examples`,
  };

  const systemMsg = 'You are a technical writer generating clear, accurate documentation from code analysis. Use markdown formatting throughout.';
  const userMsg = `${typePrompts[docType] || typePrompts.readme}

Repository analysis data:
${truncate(repoContext, 14000)}`;

  return chatCompletion([
    { role: 'system', content: systemMsg },
    { role: 'user', content: userMsg },
  ], opts);
}

// ── Context builders ────────────────────────────────────────────────────────

/**
 * Build an LLM context string from repository data.
 *
 * @param {object}   opts
 * @param {object[]} opts.files     — File records with content
 * @param {object[]} opts.symbols   — Symbol records
 * @param {object[]} opts.summaries — Existing summaries
 * @param {string}   opts.fileTree  — Stringified file tree
 * @returns {string}
 */
function buildRepoContext({ files = [], symbols = [], summaries = [], fileTree = '' }) {
  const parts = [];

  if (fileTree) {
    parts.push('=== FILE TREE ===\n' + fileTree);
  }

  if (summaries.length) {
    parts.push(
      '=== SUMMARIES ===\n' +
        summaries.map((s) => `[${s.level}] ${s.target_name}: ${s.content}`).join('\n\n'),
    );
  }

  if (symbols.length) {
    const grouped = {};
    symbols.forEach((s) => {
      const key = s.file_path || s.file_id || 'unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    parts.push(
      '=== SYMBOLS ===\n' +
        Object.entries(grouped)
          .map(
            ([file, syms]) =>
              `--- ${file} ---\n` +
              syms.map((s) => `  ${s.type}: ${s.name} (L${s.start_line}-${s.end_line}) ${s.signature || ''}`).join('\n'),
          )
          .join('\n'),
    );
  }

  // Include snippets of key files (first N lines) if available
  if (files.length) {
    const keyFiles = files.filter((f) => {
      const name = f.name?.toLowerCase() || '';
      return (
        name === 'index.js' ||
        name === 'index.ts' ||
        name === 'app.js' ||
        name === 'app.py' ||
        name === 'main.py' ||
        name === 'server.js' ||
        name === 'package.json' ||
        name === 'requirements.txt' ||
        name === 'setup.py'
      );
    });

    if (keyFiles.length) {
      parts.push(
        '=== KEY FILES ===\n' +
          keyFiles
            .map((f) => {
              const preview = (f.content || '').split('\n').slice(0, 60).join('\n');
              return `--- ${f.path} ---\n${preview}`;
            })
            .join('\n\n'),
      );
    }
  }

  return parts.join('\n\n');
}

// ── Utility ─────────────────────────────────────────────────────────────────

/**
 * Truncate text to a maximum character count, appending an ellipsis indicator.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function truncate(text, maxChars) {
  if (!text || text.length <= maxChars) return text || '';
  return text.slice(0, maxChars) + '\n... [truncated]';
}

/**
 * Extract file/function references from an LLM answer (best-effort).
 * @param {string} text
 * @returns {object[]}
 */
function extractReferences(text) {
  const refs = [];
  // Pattern: `filename.ext:functionName` or `filename.ext` (line N)
  const refPattern = /`([^`]+?\.\w{1,4})(?::(\w+))?`(?:\s*\(line\s*(\d+)(?:-(\d+))?\))?/g;
  let match;
  while ((match = refPattern.exec(text)) !== null) {
    refs.push({
      file: match[1],
      symbol: match[2] || null,
      startLine: match[3] ? parseInt(match[3], 10) : null,
      endLine: match[4] ? parseInt(match[4], 10) : null,
    });
  }
  return refs;
}

module.exports = {
  generateSummary,
  answerQuestion,
  generateDocumentation,
  buildRepoContext,
  chatCompletion,
};
