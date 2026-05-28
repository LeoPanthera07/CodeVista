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

  const primaryModel = opts.model || MODEL;
  const modelChain = [primaryModel];

  // If using the standard heavy reasoning model, set up the fallback list
  if (primaryModel === 'llama-3.3-70b-versatile') {
    modelChain.push('mixtral-8x7b-32768'); // Immediate second best model
    modelChain.push('llama-3.1-8b-instant'); // Ultra-high throughput lightweight fallback
  }

  let lastError;
  for (const model of modelChain) {
    try {
      const response = await client.chat.completions.create({
        model: model,
        messages,
        max_tokens: opts.maxTokens || MAX_TOKENS,
        temperature: opts.temperature ?? TEMPERATURE,
      });

      const choice = response.choices?.[0];
      if (!choice || !choice.message) {
        throw new Error('Empty response from Groq API');
      }
      return choice.message.content;
    } catch (err) {
      lastError = err;
      const isRateLimit = err.status === 429 || 
                          err.message?.includes('429') || 
                          err.message?.includes('rate_limit') || 
                          err.message?.includes('Limit') || 
                          err.message?.includes('exceeded');
                          
      if (isRateLimit && model !== modelChain[modelChain.length - 1]) {
        console.warn(`[LLM] 429 Rate Limit on ${model} — seamlessly hot-swapping request to next best fallback in chain`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
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
    file: `You are an expert code analyst. Provide a clear, comprehensive, and technical summary of the source file "${targetName}".
The summary should be detailed and highly structured using markdown:
- Use **bold terms** for key concepts, functions, and variables.
- Detail the file's primary purpose and architectural responsibility.
- Explain key classes, exported functions, and API interfaces (if applicable).
- List major dependencies and relationships with other files.
- Mention specific patterns, standards, or frameworks utilized (e.g., MVC, singleton, React, Express).
- When mentioning code, use inline code formatting (e.g., \`myFunction\`).

Source code and symbols:
${truncate(context, 12000)}`,

    module: `You are an expert code analyst. Provide a detailed, professional architectural summary of the module/directory "${targetName}".
Write a highly structured description utilizing rich markdown:
- **Module Core Responsibility**: Detailed breakdown of what this directory does and its role in the overall system.
- **File Interrelationships**: How the files inside this directory relate to each other and coordinate to achieve their goals.
- **Key Abstractions & Interfaces**: Main classes, utilities, and public interfaces exported by this module.
- **Design Patterns & Architecture**: Design patterns, middleware usage, or conventions followed inside this module.

Use bullet points, bold headers, and structured tables where helpful to summarize file responsibilities.

Files and summaries in this module:
${truncate(context, 12000)}`,

    repository: `You are an expert code analyst. Provide a comprehensive, high-fidelity technical summary of the entire repository "${targetName}".
Format the summary with beautiful markdown using headers, bullet lists, and bold callouts:
- **Overview & Vision**: What problem the codebase solves and its primary purpose.
- **Architecture & Tech Stack**: In-depth description of the frameworks, libraries, databases, and architectural patterns.
- **Key Subsystems & Modules**: How major folders interact, highlighting entry points and data flows.
- **Codebase Observations**: Technical strengths, architectural clean-code patterns, and potential optimization points.

Be highly technical, precise, and thorough.

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
    readme: `Generate a professional, production-grade README.md for the project "${repoName}".
The README must be visually stunning and comprehensive. Use rich GitHub Markdown (GFM) including:
- **Title and Description**: A compelling, clear summary of what the project is and its core value proposition.
- **Key Features**: Highlight features using bullet lists and bold key phrases.
- **Tech Stack Table**: Use a markdown table mapping technologies, versions, and their usage in the project.
- **Directory Structure Overview**: Display a clean visual directory tree structure using standard file tree characters (e.g. └──, ├──) and describe the main components.
- **Getting Started**: Precise installation, environment configuration, and run instructions, wrapped in fenced shell code blocks.
- **API Reference**: If applicable, a markdown table showing method, endpoint, parameters, and return payloads.
- **Alerts**: Highlight special notices or deployment cautions using GitHub alert syntax (e.g., \`> [!IMPORTANT]\`, \`> [!NOTE]\`).

Make it extremely polished, detailed, and directly usable.`,

    onboarding: `Generate a comprehensive Developer Onboarding & Guide for the codebase "${repoName}".
It should be exceptionally detailed and readable, utilizing high-quality formatting:
- **Architecture Overview**: Deep dive into the system's design and programming flow. Use callouts like \`> [!TIP]\` for development recommendations.
- **Environment Setup**: Standard commands, node versions, and configuration files, in markdown code blocks.
- **Core Concepts**: Glossary of terms, structures, and business logic specific to the app.
- **File Walkthrough**: Detailed explanations of key modules and entry points (e.g., controllers, router, services, page layouts).
- **Coding Conventions**: Best practices, lint rules, patterns (like async/await wrappers, error handlers, state management) utilized in this repo.
- **First Contribution Check-list**: Concrete steps for setting up a branch, creating a commit, running tests, and pushing a pull request.`,

    architecture: `Generate an in-depth System Architecture and Design Blueprint document for "${repoName}".
Ensure it is written like an enterprise system architect's report:
- **System Overview & Philosophy**: Design pillars, key architectural choices (e.g., modular, clean architecture, service-oriented).
- **High-Level Component Breakdown**: Descriptive high-level model, detailing frontend vs. backend, database flow, and communication layers.
- **Data Lifecycle & Request Flows**: Step-by-step description of what happens from a client request or user interaction to a database change.
- **Design Decisions Table**: A markdown table showing "Decision", "Design Choice Chosen", "Alternatives Considered", and "Rationale".
- **Integrations & Third-Party Dependencies**: Services, libraries, or APIs the project relies on, explaining *why* they were chosen.
- **Security & Performance Principles**: Authentication strategies, rate limiting, token storage, database indexing, and caching schemes.`,

    module: `Generate a detailed Module-by-Module Walkthrough and Reference Guide for the codebase "${repoName}".
For each key subdirectory/feature module in the codebase:
- **Module Purpose**: Clear, deep-dive explanation of what files in this folder accomplish.
- **Interfaces & Exports**: A markdown table or list documenting the main functions, React components, hooks, or API routes exported, with detailed signatures.
- **Sub-system Interaction**: Explain how this specific module communicates with and depends on other parts of the repository.
- **Code Usage Snippet**: Provide a concrete, copy-pasteable example showing how to import and use the components or services in this module.
- **Warnings & Edge Cases**: Highlight critical usage cautions using \`> [!WARNING]\` alerts.`,
  };

  const systemMsg = 'You are an elite technical writer generating precise, accurate, and comprehensive documentation from code analysis. Always use rich, modern markdown formatting (tables, lists, alerts, and code blocks) throughout.';
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
