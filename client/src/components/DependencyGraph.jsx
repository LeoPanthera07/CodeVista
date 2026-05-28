import React, { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { File, Folder, Database, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// Custom Node Component
const CustomNode = ({ data, selected }) => {
  const { label, extension, symbolCount, path, type } = data;
  
  const isFolder = type === 'folder';
  let nodeType = 'file';
  let Icon = File;
  
  if (isFolder) {
    nodeType = 'folder';
    Icon = Folder;
  } else {
    const ext = extension?.toLowerCase();
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
      nodeType = 'module';
      Icon = File;
    } else if (ext === 'py') {
      nodeType = 'class';
      Icon = Database;
    }
  }

  return (
    <div className={`graph-node graph-node-${nodeType} ${selected ? 'graph-node-selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: 'var(--primary)', width: 8, height: 8, border: '2px solid var(--bg-deep)' }}
      />
      <div className="graph-node-header">
        <Icon size={14} style={{ color: isFolder ? 'var(--warning)' : undefined }} />
        <span className="graph-node-label" title={path}>{label}</span>
      </div>
      <div className="graph-node-type" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span>{isFolder ? 'folder' : (extension || 'text')}</span>
        {!isFolder && symbolCount > 0 && <span style={{ color: 'var(--text-muted)' }}>{symbolCount} syms</span>}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: 'var(--violet)', width: 8, height: 8, border: '2px solid var(--bg-deep)' }}
      />
    </div>
  );
};

const nodeTypes = {
  customNode: CustomNode,
};

export default function DependencyGraph({ data = { nodes: [], edges: [] }, onNodeClick, selectedNodeId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!data.nodes || data.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // DFS Hierarchical Tree Layout Algorithm
    const childrenMap = {};
    const nodeMap = {};

    data.nodes.forEach((node) => {
      nodeMap[node.id] = node;
      childrenMap[node.id] = [];
    });

    data.edges.forEach((edge) => {
      if (edge.type === 'folder-nest') {
        if (!childrenMap[edge.source]) {
          childrenMap[edge.source] = [];
        }
        childrenMap[edge.source].push(edge.target);
      }
    });

    // Compute node depths starting from the root folder
    const depths = {};
    const computeDepth = (id, currentDepth) => {
      depths[id] = currentDepth;
      const children = childrenMap[id] || [];
      children.forEach((childId) => {
        computeDepth(childId, currentDepth + 1);
      });
    };

    if (nodeMap['dir-root']) {
      computeDepth('dir-root', 0);
    }

    // Safety fallback for orphaned files (put them at root level)
    data.nodes.forEach((node) => {
      if (depths[node.id] === undefined) {
        depths[node.id] = 0;
      }
    });

    // Pre-order DFS to calculate neat horizontal X positions
    let currentX = 0;
    const xCoords = {};

    const layoutDFS = (id) => {
      const children = childrenMap[id] || [];

      if (children.length === 0) {
        // Leaf node
        xCoords[id] = currentX;
        currentX += 280; // Neat horizontal spacing between sibling elements
      } else {
        // Center the parent folder perfectly above its subfolders/files
        children.forEach((childId) => {
          layoutDFS(childId);
        });

        const sum = children.reduce((acc, childId) => acc + xCoords[childId], 0);
        xCoords[id] = sum / children.length;
      }
    };

    if (nodeMap['dir-root']) {
      layoutDFS('dir-root');
    }

    // Construct the formatted React Flow node set
    const newNodes = data.nodes.map((node) => {
      const depth = depths[node.id] ?? 0;
      const x = xCoords[node.id] ?? 0;
      const y = depth * 220 + 50; // Vertical height layers per directory level

      return {
        id: node.id,
        type: 'customNode',
        data: {
          label: node.label,
          path: node.path,
          extension: node.extension,
          symbolCount: node.symbolCount,
          type: node.type,
        },
        position: { x, y },
        selected: selectedNodeId === node.id,
      };
    });

    // Custom Edge Styles: glowing animated dependencies vs subtle structural guides
    const newEdges = data.edges.map((edge, index) => {
      const isImport = edge.type === 'import';
      return {
        id: `e-${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
        animated: isImport,
        style: isImport
          ? { stroke: 'var(--violet)', strokeWidth: 2, opacity: 0.9, filter: 'drop-shadow(0 0 4px var(--violet))' }
          : { stroke: 'var(--glass-border-light)', strokeWidth: 1.5, strokeDasharray: '5,5', opacity: 0.6 },
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [data, selectedNodeId, setNodes, setEdges]);

  // Handle node selection in React Flow
  const onNodeClickInternal = (_event, node) => {
    const originalNode = data.nodes.find((n) => n.id === node.id);
    if (originalNode && onNodeClick) {
      onNodeClick(originalNode);
    }
  };

  const minimapStyle = {
    backgroundColor: 'var(--bg-deepest)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)',
  };

  return (
    <div className="graph-container">
      {nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
          <Database size={32} style={{ opacity: 0.5 }} />
          <span>No files found to build map</span>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClickInternal}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="rgba(148,163,184,0.15)" gap={16} size={1} />
          
          {/* Custom Zoom Controls */}
          <Controls
            showInteractive={false}
            className="graph-controls"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              border: 'none',
              background: 'transparent',
              boxShadow: 'none',
            }}
          />

          <MiniMap
            style={minimapStyle}
            nodeColor={(node) => {
              if (node.data?.type === 'folder') return 'var(--warning)';
              const ext = node.data?.extension?.toLowerCase();
              if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return 'var(--primary)';
              if (ext === 'py') return 'var(--violet)';
              return 'var(--text-muted)';
            }}
            maskColor="rgba(10, 14, 26, 0.6)"
            zoomable
            pannable
          />

          {/* Graph Legend */}
          <div className="graph-legend">
            <h4 style={{ fontSize: '11px', marginBottom: 8, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Legend
            </h4>
            <div className="graph-legend-item">
              <div className="graph-legend-dot" style={{ backgroundColor: 'var(--warning)' }} />
              <span>Folder / Directory</span>
            </div>
            <div className="graph-legend-item">
              <div className="graph-legend-dot" style={{ backgroundColor: 'var(--primary)' }} />
              <span>JS / TS / JSX / TSX</span>
            </div>
            <div className="graph-legend-item">
              <div className="graph-legend-dot" style={{ backgroundColor: 'var(--violet)' }} />
              <span>Python File</span>
            </div>
            <div className="graph-legend-item">
              <div className="graph-legend-dot" style={{ backgroundColor: 'var(--text-muted)' }} />
              <span>Other Text File</span>
            </div>
          </div>
        </ReactFlow>
      )}
    </div>
  );
}
