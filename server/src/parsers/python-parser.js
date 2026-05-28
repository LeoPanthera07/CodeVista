'use strict';

/**
 * Regex + pattern-based Python parser.
 *
 * Extracts:
 *  - Functions   (def, params, decorators, docstring, return annotation)
 *  - Classes     (class, bases, methods, docstring)
 *  - Imports     (import x / from x import y)
 *  - Decorators  (@app.route, @staticmethod, etc.)
 *  - Global variables & constants
 *  - Flask / Django routes
 *
 * @param {string} source   — Full source text
 * @param {string} filePath — Relative path for diagnostics
 * @returns {{ symbols: object[], imports: object[], exports: object[], errors: string[] }}
 */
function parsePython(source, filePath = '<unknown>') {
  const symbols = [];
  const imports = [];
  const exports = [];
  const errors = [];

  const lines = source.split('\n');

  // ── Regex Patterns ──────────────────────────────────────────────────────
  const FUNCTION_RE    = /^(\s*)def\s+(\w+)\s*\((.*?)\)\s*(?:->\s*(.+?))?\s*:\s*$/;
  const ASYNC_FUNC_RE  = /^(\s*)async\s+def\s+(\w+)\s*\((.*?)\)\s*(?:->\s*(.+?))?\s*:\s*$/;
  const CLASS_RE       = /^(\s*)class\s+(\w+)\s*(?:\((.*?)\))?\s*:\s*$/;
  const IMPORT_RE      = /^(\s*)import\s+(.+)$/;
  const FROM_IMPORT_RE = /^(\s*)from\s+(\S+)\s+import\s+(.+)$/;
  const DECORATOR_RE   = /^(\s*)@(\S+.*?)\s*$/;
  const VARIABLE_RE    = /^([A-Z_][A-Z0-9_]*)\s*[=:]/;  // UPPER_CASE constants at module level
  const ASSIGNMENT_RE  = /^(\w+)\s*(?::\s*\w[\w\[\],\s]*\s*)?=\s*(.+)$/;
  const ALL_RE         = /^__all__\s*=\s*\[([\s\S]*?)\]/;

  // Flask / Django route decorators
  const FLASK_ROUTE_RE  = /@(?:app|blueprint|bp)\.route\(\s*['"](.+?)['"]/;
  const DJANGO_PATH_RE  = /path\(\s*['"](.+?)['"]/;

  // ── Helper: find the end line of an indented block ──────────────────────
  /**
   * Given the first line index of a block (e.g. the line after `def …:`),
   * find the last line that belongs to the block based on indentation.
   * @param {number} startIdx — 0-based index of the definition line
   * @param {number} indent   — Character count of the definition's indentation
   * @returns {number} 1-based end line
   */
  function findBlockEnd(startIdx, indent) {
    let end = startIdx;
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      // Skip blank lines and comment-only lines
      if (line.trim() === '' || /^\s*#/.test(line)) {
        end = i;
        continue;
      }
      const currentIndent = line.match(/^(\s*)/)[1].length;
      if (currentIndent <= indent) break;
      end = i;
    }
    return end + 1; // 1-based
  }

  // ── Helper: extract docstring from the line after a def/class ───────────
  /**
   * @param {number} defLineIdx — 0-based index of def/class line
   * @returns {string|null}
   */
  function extractDocstring(defLineIdx) {
    const nextIdx = defLineIdx + 1;
    if (nextIdx >= lines.length) return null;
    const trimmed = lines[nextIdx].trim();

    // Single-line docstring: """text""" or '''text'''
    if (/^("""|''')(.+)\1\s*$/.test(trimmed)) {
      return trimmed;
    }

    // Multi-line docstring
    const tripleMatch = trimmed.match(/^("""|''')/);
    if (!tripleMatch) return null;
    const delim = tripleMatch[1];
    const docLines = [lines[nextIdx]];
    for (let i = nextIdx + 1; i < lines.length; i++) {
      docLines.push(lines[i]);
      if (lines[i].includes(delim)) break;
    }
    return docLines.map((l) => l.trim()).join('\n');
  }

  // ── Collect pending decorators ──────────────────────────────────────────
  let pendingDecorators = [];

  // ── Main line-by-line scan ──────────────────────────────────────────────
  const classStack = []; // { name, indent }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1; // 1-based

    // ── Decorators ──────────────────────────────────────────────────────
    const decoMatch = line.match(DECORATOR_RE);
    if (decoMatch) {
      pendingDecorators.push(decoMatch[2].trim());

      // Flask route
      const flaskMatch = line.match(FLASK_ROUTE_RE);
      if (flaskMatch) {
        // We'll attach the route to the next function
        // but also register it as a route symbol now
        const methodMatch = line.match(/methods\s*=\s*\[(.+?)\]/);
        const method = methodMatch
          ? methodMatch[1].replace(/['"]/g, '').trim()
          : 'GET';
        symbols.push({
          name: `${method} ${flaskMatch[1]}`,
          type: 'route',
          startLine: lineNum,
          endLine: lineNum,
          signature: `@app.route('${flaskMatch[1]}')`,
          docstring: null,
          metadata: { framework: 'flask', method, path: flaskMatch[1] },
        });
      }
      continue;
    }

    // ── Imports ──────────────────────────────────────────────────────────
    const fromImport = line.match(FROM_IMPORT_RE);
    if (fromImport) {
      const indent = fromImport[1].length;
      if (indent === 0) {
        const source = fromImport[2];
        const names = fromImport[3].split(',').map((n) => n.trim().replace(/\s+as\s+\w+/, ''));
        imports.push({ source, specifiers: names, startLine: lineNum, kind: 'from' });
        symbols.push({
          name: source,
          type: 'import',
          startLine: lineNum,
          endLine: lineNum,
          signature: line.trim(),
          docstring: null,
          metadata: { source, specifiers: names },
        });
      }
      pendingDecorators = [];
      continue;
    }

    const importMatch = line.match(IMPORT_RE);
    if (importMatch) {
      const indent = importMatch[1].length;
      if (indent === 0) {
        const modules = importMatch[2].split(',').map((m) => m.trim().split(/\s+as\s+/)[0]);
        modules.forEach((mod) => {
          imports.push({ source: mod, specifiers: [], startLine: lineNum, kind: 'import' });
          symbols.push({
            name: mod,
            type: 'import',
            startLine: lineNum,
            endLine: lineNum,
            signature: line.trim(),
            docstring: null,
            metadata: { source: mod },
          });
        });
      }
      pendingDecorators = [];
      continue;
    }

    // ── Classes ─────────────────────────────────────────────────────────
    const classMatch = line.match(CLASS_RE);
    if (classMatch) {
      const indent = classMatch[1].length;
      const name = classMatch[2];
      const bases = classMatch[3] ? classMatch[3].split(',').map((b) => b.trim()) : [];
      const endLine = findBlockEnd(i, indent);
      const docstring = extractDocstring(i);

      // Pop class stack if we've dedented
      while (classStack.length && classStack[classStack.length - 1].indent >= indent) {
        classStack.pop();
      }

      classStack.push({ name, indent });

      symbols.push({
        name,
        type: 'class',
        startLine: lineNum,
        endLine,
        signature: `class ${name}${bases.length ? `(${bases.join(', ')})` : ''}`,
        docstring,
        metadata: { bases, decorators: [...pendingDecorators] },
      });

      // Add to exports if at module level
      if (indent === 0) {
        exports.push({ name, kind: 'class', startLine: lineNum });
      }

      pendingDecorators = [];
      continue;
    }

    // ── Functions / Methods ─────────────────────────────────────────────
    const funcMatch = line.match(FUNCTION_RE) || line.match(ASYNC_FUNC_RE);
    if (funcMatch) {
      const indent = funcMatch[1].length;
      const name = funcMatch[2];
      const params = funcMatch[3] || '';
      const returnAnnotation = funcMatch[4] || null;
      const endLine = findBlockEnd(i, indent);
      const docstring = extractDocstring(i);
      const isAsync = ASYNC_FUNC_RE.test(line);

      // Determine if this is a method (inside a class)
      let isMethod = false;
      let parentClass = null;
      for (let ci = classStack.length - 1; ci >= 0; ci--) {
        if (classStack[ci].indent < indent) {
          isMethod = true;
          parentClass = classStack[ci].name;
          break;
        }
      }

      const paramList = params
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      symbols.push({
        name,
        type: isMethod ? 'method' : 'function',
        startLine: lineNum,
        endLine,
        signature: `${isAsync ? 'async ' : ''}def ${name}(${params})${returnAnnotation ? ' -> ' + returnAnnotation : ''}`,
        docstring,
        metadata: {
          params: paramList,
          decorators: [...pendingDecorators],
          returnAnnotation,
          async: isAsync,
          static: pendingDecorators.includes('staticmethod'),
          classMethod: pendingDecorators.includes('classmethod'),
        },
        parentName: parentClass,
      });

      // Module-level functions are implicit exports
      if (indent === 0) {
        exports.push({ name, kind: 'function', startLine: lineNum });
      }

      pendingDecorators = [];
      continue;
    }

    // ── Module-level constants / variables ───────────────────────────────
    const constMatch = line.match(VARIABLE_RE);
    if (constMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      const name = constMatch[1];
      if (!['IF', 'FOR', 'WHILE', 'WITH', 'TRY', 'ELSE', 'ELIF'].includes(name)) {
        symbols.push({
          name,
          type: 'variable',
          startLine: lineNum,
          endLine: lineNum,
          signature: line.trim(),
          docstring: null,
          metadata: { constant: true },
        });
      }
      pendingDecorators = [];
      continue;
    }

    // Regular module-level assignments (not inside class/function)
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      const assignMatch = line.match(ASSIGNMENT_RE);
      if (assignMatch) {
        const name = assignMatch[1];
        if (
          !name.startsWith('_') &&
          !['if', 'for', 'while', 'with', 'try', 'else', 'elif', 'return', 'yield', 'raise', 'del', 'print'].includes(name)
        ) {
          symbols.push({
            name,
            type: 'variable',
            startLine: lineNum,
            endLine: lineNum,
            signature: line.trim(),
            docstring: null,
            metadata: { constant: false },
          });
        }
        pendingDecorators = [];
        continue;
      }
    }

    // ── __all__ (explicit exports) ──────────────────────────────────────
    if (line.startsWith('__all__')) {
      // Try multi-line
      let allText = '';
      for (let j = i; j < lines.length; j++) {
        allText += lines[j] + '\n';
        if (lines[j].includes(']')) break;
      }
      const match = allText.match(/__all__\s*=\s*\[([\s\S]*?)\]/);
      if (match) {
        const names = match[1].match(/['"](\w+)['"]/g) || [];
        names.forEach((n) => {
          const cleanName = n.replace(/['"]/g, '');
          exports.push({ name: cleanName, kind: '__all__', startLine: lineNum });
        });
      }
    }

    pendingDecorators = [];
  }

  return { symbols, imports, exports, errors };
}

module.exports = { parsePython };
