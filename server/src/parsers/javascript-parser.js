'use strict';

const parser = require('@babel/parser');
const _traverse = require('@babel/traverse');

// Handle both CJS default export shapes that @babel/traverse can produce
const traverse = typeof _traverse === 'function' ? _traverse : _traverse.default;

/**
 * Babel parser plugins — covers JS, JSX, TS, TSX, and common proposals.
 */
const PARSER_PLUGINS = [
  'jsx',
  'typescript',
  'decorators-legacy',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'exportDefaultFrom',
  'exportNamespaceFrom',
  'dynamicImport',
  'optionalChaining',
  'nullishCoalescingOperator',
  'optionalCatchBinding',
  'objectRestSpread',
  'topLevelAwait',
];

/**
 * Parse a JavaScript / TypeScript source file and extract all symbols.
 *
 * Extracts:
 * - Functions (name, params, return type, JSDoc, start/end line)
 * - Classes (name, superClass, methods, properties)
 * - Imports (source module, specifiers)
 * - Exports (named, default)
 * - React components (function components detected by JSX return + PascalCase)
 * - Express routes (app.get / router.post / …)
 * - Variable declarations
 *
 * @param {string} source   — Full source code of the file
 * @param {string} filePath — Relative path (used for diagnostics only)
 * @returns {{ symbols: object[], imports: object[], exports: object[], errors: string[] }}
 */
function parseJavaScript(source, filePath = '<unknown>') {
  const symbols = [];
  const imports = [];
  const exports = [];
  const errors = [];

  let ast;
  try {
    ast = parser.parse(source, {
      sourceType: 'unambiguous',
      plugins: PARSER_PLUGINS,
      errorRecovery: true,
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
    });
  } catch (err) {
    errors.push(`Parse error in ${filePath}: ${err.message}`);
    return { symbols, imports, exports, errors };
  }

  // Collect any parser errors that were recovered
  if (ast.errors && ast.errors.length) {
    ast.errors.forEach((e) => errors.push(`Recovered parse error: ${e.message}`));
  }

  const sourceLines = source.split('\n');

  // ── Helper: extract leading JSDoc / block comment ────────────────────────
  /**
   * @param {object} node — AST node
   * @returns {string|null}
   */
  function extractDocstring(node) {
    if (!node.leadingComments || node.leadingComments.length === 0) return null;
    const last = node.leadingComments[node.leadingComments.length - 1];
    if (last.type === 'CommentBlock' && last.value.startsWith('*')) {
      return `/*${last.value}*/`;
    }
    return null;
  }

  // ── Helper: serialise function params ────────────────────────────────────
  /**
   * @param {object[]} params
   * @returns {string}
   */
  function serializeParams(params) {
    return params
      .map((p) => {
        if (p.type === 'Identifier') return p.name;
        if (p.type === 'AssignmentPattern' && p.left.type === 'Identifier') return `${p.left.name}=…`;
        if (p.type === 'RestElement' && p.argument.type === 'Identifier') return `...${p.argument.name}`;
        if (p.type === 'ObjectPattern') return '{…}';
        if (p.type === 'ArrayPattern') return '[…]';
        return '?';
      })
      .join(', ');
  }

  // ── Helper: detect if a function body returns JSX ────────────────────────
  /**
   * @param {object} node
   * @returns {boolean}
   */
  function returnsJSX(node) {
    let found = false;
    if (!node.body) return false;
    traverse(
      node,
      {
        ReturnStatement(innerPath) {
          const arg = innerPath.node.argument;
          if (arg && (arg.type === 'JSXElement' || arg.type === 'JSXFragment')) {
            found = true;
            innerPath.stop();
          }
        },
      },
      undefined,
      { noScope: true },
    );
    return found;
  }

  // ── Helper: detect Express route registrations ───────────────────────────
  const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'use']);

  /**
   * @param {object} node — CallExpression node
   * @returns {{ method: string, path: string } | null}
   */
  function extractRoute(node) {
    const callee = node.callee;
    if (callee.type !== 'MemberExpression') return null;
    const method = callee.property.name || callee.property.value;
    if (!HTTP_METHODS.has(method)) return null;

    // Ensure the object looks like app / router / server
    const objName =
      callee.object.type === 'Identifier'
        ? callee.object.name
        : callee.object.type === 'MemberExpression' && callee.object.property
          ? callee.object.property.name
          : null;
    if (!objName) return null;
    const lowerObj = objName.toLowerCase();
    if (!['app', 'router', 'server', 'route'].some((n) => lowerObj.includes(n))) return null;

    const firstArg = node.arguments[0];
    const routePath =
      firstArg && (firstArg.type === 'StringLiteral' || firstArg.type === 'TemplateLiteral')
        ? firstArg.value || sourceLines[firstArg.loc.start.line - 1]?.trim()
        : '*';

    return { method: method.toUpperCase(), path: routePath };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Main AST traversal
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    traverse(ast, {
      // ── Functions ─────────────────────────────────────────────────────────
      FunctionDeclaration(path) {
        const node = path.node;
        const name = node.id ? node.id.name : '<anonymous>';
        const params = serializeParams(node.params);
        const isPascal = /^[A-Z]/.test(name);
        const isComponent = isPascal && returnsJSX(node);

        symbols.push({
          name,
          type: isComponent ? 'component' : 'function',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          signature: `function ${name}(${params})`,
          docstring: extractDocstring(node),
          metadata: { params: node.params.length, async: node.async, generator: node.generator },
        });
      },

      // ── Arrow / function expressions assigned to variables ────────────
      VariableDeclarator(path) {
        const node = path.node;
        const init = node.init;
        if (!init) return;

        const name = node.id.type === 'Identifier' ? node.id.name : null;
        if (!name) return;

        if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') {
          const params = serializeParams(init.params);
          const isPascal = /^[A-Z]/.test(name);
          const isComponent = isPascal && returnsJSX(init);

          symbols.push({
            name,
            type: isComponent ? 'component' : 'function',
            startLine: path.parent.loc.start.line,
            endLine: path.parent.loc.end.line,
            signature: `const ${name} = (${params}) =>`,
            docstring: extractDocstring(path.parent),
            metadata: { params: init.params.length, async: init.async, arrow: true },
          });
        } else if (
          init.type === 'CallExpression' &&
          init.callee.type === 'Identifier' &&
          ['memo', 'forwardRef', 'lazy'].includes(init.callee.name)
        ) {
          // React.memo / React.forwardRef wrappers
          symbols.push({
            name,
            type: 'component',
            startLine: path.parent.loc.start.line,
            endLine: path.parent.loc.end.line,
            signature: `const ${name} = ${init.callee.name}(…)`,
            docstring: extractDocstring(path.parent),
            metadata: { wrapper: init.callee.name },
          });
        } else {
          // Plain variable
          symbols.push({
            name,
            type: 'variable',
            startLine: path.parent.loc.start.line,
            endLine: path.parent.loc.end.line,
            signature: `${path.parent.kind} ${name}`,
            docstring: extractDocstring(path.parent),
            metadata: { kind: path.parent.kind },
          });
        }
      },

      // ── Classes ───────────────────────────────────────────────────────────
      ClassDeclaration(path) {
        const node = path.node;
        const name = node.id ? node.id.name : '<AnonymousClass>';
        const superClass = node.superClass
          ? node.superClass.type === 'Identifier'
            ? node.superClass.name
            : '<expression>'
          : null;

        const methods = [];
        const properties = [];

        node.body.body.forEach((member) => {
          if (member.type === 'ClassMethod' || member.type === 'ClassPrivateMethod') {
            const mName =
              member.key.type === 'Identifier'
                ? member.key.name
                : member.key.type === 'PrivateName'
                  ? `#${member.key.id.name}`
                  : '<computed>';
            const mParams = serializeParams(member.params);
            methods.push({
              name: mName,
              kind: member.kind, // constructor, method, get, set
              static: member.static,
              startLine: member.loc.start.line,
              endLine: member.loc.end.line,
              signature: `${member.static ? 'static ' : ''}${member.kind === 'constructor' ? 'constructor' : mName}(${mParams})`,
            });
          } else if (member.type === 'ClassProperty' || member.type === 'ClassPrivateProperty') {
            const pName =
              member.key.type === 'Identifier'
                ? member.key.name
                : member.key.type === 'PrivateName'
                  ? `#${member.key.id.name}`
                  : '<computed>';
            properties.push({ name: pName, static: member.static });
          }
        });

        symbols.push({
          name,
          type: 'class',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          signature: `class ${name}${superClass ? ` extends ${superClass}` : ''}`,
          docstring: extractDocstring(node),
          metadata: { superClass, methods, properties },
        });

        // Also register each method as its own symbol
        methods.forEach((m) => {
          symbols.push({
            name: m.name,
            type: 'method',
            startLine: m.startLine,
            endLine: m.endLine,
            signature: m.signature,
            docstring: null,
            metadata: { className: name, kind: m.kind, static: m.static },
            parentName: name,
          });
        });
      },

      // ── Imports ───────────────────────────────────────────────────────────
      ImportDeclaration(path) {
        const node = path.node;
        const source = node.source.value;
        const specifiers = node.specifiers.map((s) => {
          if (s.type === 'ImportDefaultSpecifier') return { name: s.local.name, kind: 'default' };
          if (s.type === 'ImportNamespaceSpecifier') return { name: s.local.name, kind: 'namespace' };
          return {
            name: s.local.name,
            imported: s.imported ? s.imported.name : s.local.name,
            kind: 'named',
          };
        });

        imports.push({ source, specifiers, startLine: node.loc.start.line });

        symbols.push({
          name: source,
          type: 'import',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          signature: sourceLines[node.loc.start.line - 1]?.trim() || '',
          docstring: null,
          metadata: { source, specifiers },
        });
      },

      // ── CJS require() ────────────────────────────────────────────────────
      CallExpression(path) {
        const node = path.node;

        // require('…')
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length === 1 &&
          node.arguments[0].type === 'StringLiteral'
        ) {
          const source = node.arguments[0].value;
          imports.push({
            source,
            specifiers: [],
            startLine: node.loc.start.line,
            kind: 'require',
          });
        }

        // Express routes: app.get('/path', handler)
        const route = extractRoute(node);
        if (route) {
          symbols.push({
            name: `${route.method} ${route.path}`,
            type: 'route',
            startLine: node.loc.start.line,
            endLine: node.loc.end.line,
            signature: `${route.method} ${route.path}`,
            docstring: null,
            metadata: route,
          });
        }
      },

      // ── Named Exports ────────────────────────────────────────────────────
      ExportNamedDeclaration(path) {
        const node = path.node;
        if (node.declaration) {
          // export function foo() { … } / export class Bar { … }
          const decl = node.declaration;
          if (decl.id) {
            exports.push({ name: decl.id.name, kind: 'named', startLine: node.loc.start.line });
          } else if (decl.declarations) {
            decl.declarations.forEach((d) => {
              if (d.id && d.id.type === 'Identifier') {
                exports.push({ name: d.id.name, kind: 'named', startLine: node.loc.start.line });
              }
            });
          }
        }
        if (node.specifiers) {
          node.specifiers.forEach((s) => {
            exports.push({
              name: (s.exported.type === 'Identifier' ? s.exported.name : s.exported.value),
              kind: 'named',
              startLine: node.loc.start.line,
            });
          });
        }
      },

      ExportDefaultDeclaration(path) {
        const node = path.node;
        const decl = node.declaration;
        const name =
          decl.type === 'Identifier'
            ? decl.name
            : decl.id
              ? decl.id.name
              : '<default>';
        exports.push({ name, kind: 'default', startLine: node.loc.start.line });

        symbols.push({
          name,
          type: 'export',
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          signature: `export default ${name}`,
          docstring: null,
          metadata: { kind: 'default' },
        });
      },

      // module.exports = …
      AssignmentExpression(path) {
        const node = path.node;
        const left = node.left;
        if (
          left.type === 'MemberExpression' &&
          left.object.type === 'Identifier' &&
          left.object.name === 'module' &&
          left.property.type === 'Identifier' &&
          left.property.name === 'exports'
        ) {
          const right = node.right;
          if (right.type === 'ObjectExpression') {
            right.properties.forEach((prop) => {
              if (prop.key && (prop.key.type === 'Identifier' || prop.key.type === 'StringLiteral')) {
                const expName = prop.key.name || prop.key.value;
                exports.push({ name: expName, kind: 'cjs', startLine: node.loc.start.line });
              }
            });
          } else if (right.type === 'Identifier') {
            exports.push({ name: right.name, kind: 'cjs', startLine: node.loc.start.line });
          }
        }
      },
    });
  } catch (err) {
    errors.push(`Traversal error in ${filePath}: ${err.message}`);
  }

  return { symbols, imports, exports, errors };
}

module.exports = { parseJavaScript };
