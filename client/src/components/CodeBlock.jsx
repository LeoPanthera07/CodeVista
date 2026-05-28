import { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';

// Lazy load shiki
let highlighterPromise = null;
function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki/bundle/web').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['github-dark-default'],
        langs: [
          'javascript', 'typescript', 'jsx', 'tsx', 'python', 'java', 'go',
          'rust', 'c', 'cpp', 'csharp', 'ruby', 'php', 'swift', 'kotlin',
          'html', 'css', 'json', 'yaml', 'markdown', 'bash', 'sql', 'xml',
        ],
      })
    );
  }
  return highlighterPromise;
}

export default function CodeBlock({ code, language = 'text', showLineNumbers = true }) {
  const [html, setHtml] = useState('');
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getHighlighter().then(highlighter => {
      if (cancelled) return;
      try {
        const supported = highlighter.getLoadedLanguages();
        const lang = supported.includes(language) ? language : 'text';
        const result = highlighter.codeToHtml(code, {
          lang,
          theme: 'github-dark-default',
        });
        setHtml(result);
      } catch {
        setHtml('');
      }
    }).catch(() => setHtml(''));
    return () => { cancelled = true; };
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const lines = code.split('\n');

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{language}</span>
        <button
          className="code-block-copy"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="code-block-content">
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <div className="code-block-lines">
            {showLineNumbers && (
              <div className="code-block-line-numbers">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            )}
            <pre><code>{code}</code></pre>
          </div>
        )}
      </div>
    </div>
  );
}
