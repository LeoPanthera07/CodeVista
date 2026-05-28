'use strict';

const { parseJavaScript } = require('./javascript-parser');
const { parsePython } = require('./python-parser');

/**
 * Maps file extensions to their parser function.
 * @type {Record<string, (source: string, filePath: string) => object>}
 */
const PARSER_MAP = {
  js: parseJavaScript,
  jsx: parseJavaScript,
  ts: parseJavaScript,
  tsx: parseJavaScript,
  mjs: parseJavaScript,
  cjs: parseJavaScript,
  py: parsePython,
  pyw: parsePython,
};

/**
 * Returns the set of file extensions the parsing system supports.
 * @returns {Set<string>}
 */
function supportedExtensions() {
  return new Set(Object.keys(PARSER_MAP));
}

/**
 * Check whether a given file extension has a registered parser.
 * @param {string} ext — File extension without leading dot (e.g. "js")
 * @returns {boolean}
 */
function canParse(ext) {
  return ext in PARSER_MAP;
}

/**
 * Parse source code using the appropriate parser for the given extension.
 *
 * @param {string} source   — Full source code
 * @param {string} ext      — File extension without dot (e.g. "py")
 * @param {string} filePath — Relative path (for diagnostics)
 * @returns {{ symbols: object[], imports: object[], exports: object[], errors: string[] }}
 * @throws {Error} If no parser is registered for the extension
 */
function parse(source, ext, filePath) {
  const parser = PARSER_MAP[ext];
  if (!parser) {
    throw new Error(`No parser registered for extension: .${ext}`);
  }
  return parser(source, filePath);
}

module.exports = { parse, canParse, supportedExtensions };
