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
  const { label, extension, symbolCount, path } = data;
  
  // Custom styling depending on the extension
  let type = 'file';
  let Icon = File;
  
  const ext = extension?.toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
    type = 'module';
    Icon = File;
  } else if (ext === 'py') {
    type = 'class';
    Icon = Database;
  }

  return (
    <div className={`graph-node graph-node-${type} ${selected ? 'graph-node-selected' : ''}`}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: 'var(--primary)', width: 8, height: 8, border: '2px solid var(--bg-deep)' }}
      />
      <div className="graph-node-header">
        <Icon size={14} />
        <span className="graph-node-label" title={path}>{label}</span>
      </div>
      <div className="graph-node-type" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span>{ext || 'text'}</span>
        {symbolCount > 0 && <span style={{ color: 'var(--text-muted)' }}>{symbolCount} syms</span>}
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

    // Grid Layout Algorithm
    const itemsPerRow = Math.ceil(Math.sqrt(data.nodes.length));
    const newNodes = data.nodes.map((node, index) => {
      const col = index % itemsPerRow;
      const row = Math.floor(index / itemsPerRow);
      
      return {
        id: node.id,
        type: 'customNode',
        data: {
          label: node.label,
          path: node.path,
          extension: node.extension,
          symbolCount: node.symbolCount,
        },
        position: { x: col * 260 + 50, y: row * 160 + 50 },
        selected: selectedNodeId === node.id,
      };
    });

    const newEdges = data.edges.map((edge, index) => ({
      id: `e-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      animated: true,
      style: { stroke: 'var(--primary)', strokeWidth: 1.5, opacity: 0.7 },
    }));

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
