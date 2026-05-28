import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Search } from 'lucide-react';

function getFileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  const iconMap = {
    js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
    py: '🐍', rb: '💎', go: '🔵', rs: '🦀',
    java: '☕', css: '🎨', html: '🌐', json: '📋',
    md: '📝', yml: '⚙️', yaml: '⚙️',
  };
  return iconMap[ext] || null;
}

function TreeNode({ node, depth = 0, activeFile, onFileClick, searchTerm }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === 'directory' || (node.children && node.children.length > 0);

  const filteredChildren = useMemo(() => {
    if (!node.children) return [];
    if (!searchTerm) return node.children;
    return node.children.filter(child => {
      if (child.type === 'file' || !child.children) {
        return child.name.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return hasMatchingChild(child, searchTerm);
    });
  }, [node.children, searchTerm]);

  const isActive = activeFile === node.path;

  if (searchTerm && isDir && filteredChildren.length === 0) return null;

  const shouldAutoExpand = searchTerm && isDir && filteredChildren.length > 0;

  return (
    <div>
      <div
        className={`file-tree-item ${isActive ? 'file-tree-item-active' : ''} ${isDir ? 'file-tree-item-folder' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (isDir) setExpanded(!expanded);
          else onFileClick?.(node);
        }}
        role="treeitem"
        aria-expanded={isDir ? expanded || shouldAutoExpand : undefined}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (isDir) setExpanded(!expanded);
            else onFileClick?.(node);
          }
        }}
      >
        {isDir ? (
          <>
            {(expanded || shouldAutoExpand) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {(expanded || shouldAutoExpand) ? <FolderOpen size={16} /> : <Folder size={16} />}
          </>
        ) : (
          <>
            <span style={{ width: 14, display: 'inline-block' }} />
            {getFileIcon(node.name) ? (
              <span style={{ fontSize: '14px', lineHeight: 1 }}>{getFileIcon(node.name)}</span>
            ) : (
              <File size={16} />
            )}
          </>
        )}
        <span className="file-tree-item-name">{node.name}</span>
      </div>
      {isDir && (expanded || shouldAutoExpand) && filteredChildren.length > 0 && (
        <div className="file-tree-children" role="group">
          {filteredChildren
            .sort((a, b) => {
              const aDir = a.type === 'directory' || !!a.children;
              const bDir = b.type === 'directory' || !!b.children;
              if (aDir && !bDir) return -1;
              if (!aDir && bDir) return 1;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <TreeNode
                key={child.path || child.name}
                node={child}
                depth={depth + 1}
                activeFile={activeFile}
                onFileClick={onFileClick}
                searchTerm={searchTerm}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function hasMatchingChild(node, term) {
  if (!node.children) return false;
  return node.children.some(child => {
    if (child.name.toLowerCase().includes(term.toLowerCase())) return true;
    if (child.children) return hasMatchingChild(child, term);
    return false;
  });
}

export default function FileTree({ files = [], activeFile, onFileClick }) {
  const [search, setSearch] = useState('');

  const tree = useMemo(() => {
    if (!files || files.length === 0) return [];
    // If files is already a tree structure, use as is
    if (files[0]?.children !== undefined || files[0]?.type) return files;
    // Convert flat array of paths to tree
    return buildTree(files);
  }, [files]);

  return (
    <div className="file-tree" role="tree" aria-label="File tree">
      <div className="file-tree-search">
        <div className="input-with-icon">
          <Search className="input-icon" />
          <input
            type="text"
            className="input-field"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search files"
          />
        </div>
      </div>
      <div className="file-tree-list">
        {tree.map((node) => (
          <TreeNode
            key={node.path || node.name}
            node={node}
            activeFile={activeFile}
            onFileClick={onFileClick}
            searchTerm={search}
          />
        ))}
      </div>
    </div>
  );
}

function buildTree(paths) {
  const root = {};
  for (const filePath of paths) {
    const p = typeof filePath === 'string' ? filePath : filePath.path;
    if (!p) continue;
    const parts = p.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = i === parts.length - 1
          ? { __file: true, path: p, name: part }
          : {};
      }
      current = current[part];
    }
  }

  function toNodes(obj, parentPath = '') {
    return Object.entries(obj)
      .filter(([key]) => key !== '__file' && key !== 'path' && key !== 'name')
      .map(([key, value]) => {
        const path = parentPath ? `${parentPath}/${key}` : key;
        if (value.__file) {
          return { name: key, path: value.path || path, type: 'file' };
        }
        return {
          name: key,
          path,
          type: 'directory',
          children: toNodes(value, path),
        };
      });
  }

  return toNodes(root);
}
