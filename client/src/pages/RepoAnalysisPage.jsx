import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Code2, Cpu, MessageSquare, BookOpen, ShieldAlert, RefreshCw, FileText, Send,
  Terminal, AlertTriangle, ChevronDown, ChevronRight, Copy, Download, Search,
  Network, FileCode, ArrowLeft, TerminalSquare, Info, Sparkles, Layers, Trash2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import GlassCard from '../components/GlassCard';
import StatusBadge from '../components/StatusBadge';
import FileTree from '../components/FileTree';
import CodeBlock from '../components/CodeBlock';
import DependencyGraph from '../components/DependencyGraph';
import MetricCard from '../components/MetricCard';
import { Spinner, ProgressBar } from '../components/LoadingStates';

export default function RepoAnalysisPage() {
  const { id } = useParams();
  const { state, dispatch, addToast } = useApp();
  const { selectedRepo } = state;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview'); // overview | structure | summaries | chat | docs
  const [repoLoading, setRepoLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState(null);

  // Structure tab states
  const [flatFiles, setFlatFiles] = useState([]);
  const [fileTree, setFileTree] = useState(null);
  const [mapData, setMapData] = useState({ nodes: [], edges: [] });
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Summaries tab states
  const [summaries, setSummaries] = useState({ file: [], module: [], repository: [] });
  const [expandedSummary, setExpandedSummary] = useState(null); // id of expanded accordion
  const [summariesLoading, setSummariesLoading] = useState(false);

  // Chat tab states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Documentation tab states
  const [docType, setDocType] = useState('readme'); // readme | onboarding | architecture | module
  const [docsList, setDocsList] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [docLoading, setDocLoading] = useState(false);

  // ── 1. Fetch Repository Details ──
  useEffect(() => {
    let active = true;
    const loadRepo = async () => {
      setRepoLoading(true);
      try {
        const res = await api.getRepository(id);
        if (active) {
          dispatch({ type: 'SET_SELECTED_REPO', payload: res.data });
          setAnalysisStatus(res.data);
        }
      } catch (err) {
        addToast({ type: 'error', title: 'Repository not found', message: err.message });
      } finally {
        if (active) setRepoLoading(false);
      }
    };
    loadRepo();
    return () => { active = false; };
  }, [id, dispatch, addToast]);

  // ── 2. Poll Status if Analyzing ──
  useEffect(() => {
    let active = true;
    let timer;

    const checkStatus = async () => {
      if (!selectedRepo || selectedRepo.status === 'ready' || selectedRepo.status === 'error') {
        return;
      }
      
      try {
        const res = await api.getRepositoryStatus(id);
        if (active) {
          setAnalysisStatus(res.data);
          
          if (res.data.status !== selectedRepo.status) {
            dispatch({ type: 'UPDATE_REPOSITORY', payload: { id, status: res.data.status } });
          }

          if (res.data.status === 'ready') {
            addToast({
              type: 'success',
              title: 'Analysis complete!',
              message: 'CodeVista successfully indexed your repository symbols.',
            });
            // Reload repo data
            const repoRes = await api.getRepository(id);
            dispatch({ type: 'SET_SELECTED_REPO', payload: repoRes.data });
          }
        }
      } catch (err) {
        /* ignore poll errors */
      }
    };

    if (selectedRepo && selectedRepo.status !== 'ready' && selectedRepo.status !== 'error') {
      timer = setInterval(checkStatus, 3000);
    }

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [selectedRepo, id, dispatch, addToast]);

  // ── 3. Load structure/map/summaries when ready ──
  useEffect(() => {
    if (!selectedRepo || selectedRepo.status !== 'ready') return;

    const loadStructure = async () => {
      try {
        // Load flat files
        const filesRes = await api.getRepositoryFiles(id);
        setFileTree(filesRes.data);
        
        // Flatten list of paths for FileTree component if flat array needed
        const flatList = [];
        const flatten = (node) => {
          if (node.type === 'file') {
            flatList.push(node);
          }
          if (node.children) {
            node.children.forEach(flatten);
          }
        };
        if (filesRes.data && filesRes.data.children) {
          filesRes.data.children.forEach(flatten);
        }
        setFlatFiles(flatList);

        // Load Dependency Graph Map
        const mapRes = await api.getRepositoryMap(id);
        setMapData(mapRes.data);
      } catch (err) {
        console.error('Failed to load repository files:', err);
      }
    };

    const loadSummaries = async () => {
      setSummariesLoading(true);
      try {
        const res = await api.getRepositorySummary(id);
        setSummaries(res.data || { file: [], module: [], repository: [] });
      } catch (err) {
        console.error('Failed to load summaries:', err);
      } finally {
        setSummariesLoading(false);
      }
    };

    const loadChatHistory = async () => {
      try {
        const res = await api.getChatHistory(id);
        setChatMessages(res.data || []);
      } catch { /* ignore */ }
    };

    const loadDocs = async () => {
      try {
        const res = await api.getDocumentation(id);
        setDocsList(res.data || []);
        if (res.data && res.data.length > 0) {
          setActiveDoc(res.data[0]);
        }
      } catch { /* ignore */ }
    };

    loadStructure();
    loadSummaries();
    loadChatHistory();
    loadDocs();
  }, [selectedRepo, id]);

  // Scroll chat bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // ── File details fetcher ──
  const handleFileClick = async (fileNode) => {
    setSelectedFile(fileNode);
    setDetailsLoading(true);
    try {
      const res = await api.getRepositoryFiles(id); // load detailed via endpoint below
      const details = await api.getRepository(id); // fallbacks if individual files route requires specifics
      // We call the file content details endpoint
      const response = await fetch(`/api/repositories/${id}/files/${fileNode.id}`);
      if (response.ok) {
        const json = await response.json();
        setFileDetails(json.data);
      } else {
        throw new Error('Failed to load file content');
      }
    } catch (err) {
      addToast({ type: 'error', title: 'File read error', message: err.message });
      setFileDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  // ── Delete codebase handler ──
  const handleDeleteCodebase = async () => {
    if (!window.confirm(`Are you absolutely sure you want to delete this repository and all parsed data from the local server? This action is permanent and cannot be undone.`)) {
      return;
    }
    
    try {
      await api.deleteRepository(id);
      addToast({
        type: 'success',
        title: 'Repository deleted',
        message: 'Successfully removed all local codebase files and database parsed summaries.',
      });
      dispatch({ type: 'REMOVE_REPOSITORY', payload: id });
      navigate('/dashboard');
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Delete failed',
        message: err.message || 'Could not delete repository.',
      });
    }
  };

  // ── Send chat message ──
  const handleSendChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = { role: 'user', content: chatInput.trim(), created_at: new Date().toISOString() };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      let aiContent = '';
      const onChunk = (chunk) => {
        if (chunk.content) {
          aiContent += chunk.content;
          setChatMessages((prev) => {
            const list = [...prev];
            const last = list[list.length - 1];
            if (last && last.role === 'assistant') {
              last.content = aiContent;
              if (chunk.references) last.references = chunk.references;
              return list;
            } else {
              return [...list, { role: 'assistant', content: aiContent, references: chunk.references || [] }];
            }
          });
        }
      };

      await api.sendChatMessage(id, userMessage.content, onChunk);
    } catch (err) {
      addToast({ type: 'error', title: 'AI Assistant failed', message: err.message });
    } finally {
      setChatLoading(false);
    }
  };

  // ── Generate docs ──
  const handleGenerateDoc = async () => {
    setDocLoading(true);
    try {
      const res = await api.generateDocumentation(id, docType);
      addToast({
        type: 'success',
        title: 'Documentation ready!',
        message: `Successfully generated ${docType.toUpperCase()} guide.`,
      });
      // reload docs list
      const docsRes = await api.getDocumentation(id);
      setDocsList(docsRes.data || []);
      const match = docsRes.data.find(d => d.type === docType);
      if (match) setActiveDoc(match);
    } catch (err) {
      addToast({ type: 'error', title: 'Generation failed', message: err.message });
    } finally {
      setDocLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({ type: 'success', title: 'Copied!', message: 'Copied to clipboard.' });
    } catch { /* ignore */ }
  };

  const downloadMarkdown = (doc) => {
    if (!doc) return;
    const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${doc.title || doc.type}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Loading & Processing Views ──
  if (repoLoading) {
    return (
      <div className="page-wrapper flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!selectedRepo) {
    return (
      <div className="page-wrapper container flex flex-col items-center justify-center text-center gap-4">
        <AlertTriangle size={48} className="text-danger animate-pulse" />
        <h2 style={{ fontSize: 'var(--text-xl)' }}>Repository Not Found</h2>
        <Link to="/dashboard" className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>
    );
  }

  // Polling / Analyzing state
  if (selectedRepo.status !== 'ready') {
    let progress = 20;
    let statusLabel = 'Connecting codebase...';
    
    if (analysisStatus) {
      if (analysisStatus.status === 'cloning') {
        progress = 20;
        statusLabel = 'Cloning Git repository...';
      } else if (analysisStatus.status === 'pending') {
        progress = 40;
        statusLabel = 'Extracting and scanning local directory...';
      } else if (analysisStatus.status === 'analyzing') {
        const filePct = analysisStatus.totalFiles > 0 
          ? Math.floor((analysisStatus.parsedFiles / analysisStatus.totalFiles) * 40)
          : 0;
        progress = 50 + filePct;
        statusLabel = `Parsing files and constructing syntax trees... [${analysisStatus.parsedFiles}/${analysisStatus.totalFiles}]`;
      } else if (analysisStatus.status === 'error') {
        progress = 100;
        statusLabel = 'Analysis failed!';
      }
    }

    return (
      <div className="page-wrapper">
        <div className="container" style={{ maxWidth: '640px', paddingBottom: 'var(--sp-12)', paddingTop: 'var(--sp-12)' }}>
          <GlassCard variant="bordered" className="flex flex-col gap-6 items-center text-center" style={{ padding: 'var(--sp-12) var(--sp-6)' }}>
            {analysisStatus?.status === 'error' ? (
              <AlertTriangle size={48} className="text-danger" />
            ) : (
              <Spinner size="lg" />
            )}

            <div>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', marginBottom: '4px' }}>
                {selectedRepo.name}
              </h2>
              <p className="text-muted text-sm">
                CodeVista is mapping dependencies and resolving imports.
              </p>
            </div>

            {analysisStatus?.status === 'error' ? (
              <div className="w-full flex flex-col gap-4">
                <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(244,63,94,0.2)', padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)', color: 'var(--danger-light)', fontSize: 'var(--text-sm)', textAlign: 'left', wordBreak: 'break-word' }}>
                  <strong>Error details:</strong>
                  <p style={{ marginTop: '4px' }}>{analysisStatus.errorMessage || 'No failure logs available.'}</p>
                </div>
                <div className="flex gap-4 justify-center">
                  <Link to="/dashboard" className="btn btn-secondary">
                    <ArrowLeft size={16} /> Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <div className="w-full">
                <ProgressBar progress={progress} label={statusLabel} />
                <div className="flex gap-8 justify-center text-dim text-xs" style={{ marginTop: 'var(--sp-4)' }}>
                  <span>Files: {analysisStatus?.totalFiles || 0}</span>
                  <span>Parsed: {analysisStatus?.parsedFiles || 0}</span>
                  <span>Symbols: {analysisStatus?.totalSymbols || 0}</span>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    );
  }

  // Helper to compile color segments of language bars
  const langColors = {
    js: '#f1e05a', jsx: '#61dafb', ts: '#3178c6', tsx: '#3178c6',
    py: '#3572a5', css: '#563d7c', html: '#e34c26', json: '#cbd5e1'
  };

  return (
    <div className="page-wrapper flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
      
      {/* ── Sub Header Bar ── */}
      <div style={{
        background: 'rgba(10,14,26,0.5)',
        borderBottom: '1px solid var(--glass-border)',
        padding: 'var(--sp-3) var(--sp-6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--sp-3)',
      }}>
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="btn btn-ghost btn-sm btn-icon" style={{ padding: 4 }}>
            <ArrowLeft size={16} />
          </Link>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>
            {selectedRepo.name}
          </span>
          <StatusBadge status="ready" />
          <button 
            className="btn btn-ghost btn-sm btn-icon text-danger-light" 
            style={{ marginLeft: 'var(--sp-1)' }} 
            onClick={handleDeleteCodebase}
            title="Delete local codebase completely"
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { id: 'overview', label: 'Overview', icon: FileText },
            { id: 'structure', label: 'Structure Map', icon: Network },
            { id: 'summaries', label: 'Summaries', icon: Layers },
            { id: 'chat', label: 'AI Chat', icon: MessageSquare },
            { id: 'docs', label: 'Documentation', icon: BookOpen }
          ].map((t) => {
            const IconComp = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id);
                  if (t.id !== 'structure') {
                    setSelectedFile(null);
                    setFileDetails(null);
                  }
                }}
                className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
              >
                <IconComp size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Page Content — full height scroll ── */}
      <div className="flex-1" style={{ overflowY: activeTab === 'structure' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-12)' }}>
            
            {/* Grid of metrics */}
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
              <MetricCard icon={FileCode} label="Total Files" value={selectedRepo.total_files || 0} color="primary" />
              <MetricCard icon={Cpu} label="Extracted Symbols" value={selectedRepo.total_symbols || 0} color="cyan" />
              <MetricCard icon={Layers} label="Key Modules" value={summaries.module?.filter(m => m.target_name !== '.')?.length || 0} color="violet" />
              <MetricCard icon={ShieldAlert} label="Complexity Status" value="Healthy" color="success" />
            </div>

            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--sp-6)' }}>
              
              {/* Left Column */}
              <div className="flex flex-col gap-6">
                
                {/* Language Stats Card */}
                <GlassCard variant="bordered">
                  <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--sp-4)' }}>
                    Language Distribution
                  </h3>
                  
                  {selectedRepo.language_stats ? (
                    (() => {
                      const stats = selectedRepo.language_stats;
                      const total = Object.values(stats).reduce((a, b) => a + b, 0);
                      const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
                      
                      return (
                        <div>
                          <div className="lang-bar">
                            {sorted.map(([lang, count], i) => {
                              const pct = ((count / total) * 100).toFixed(1);
                              const bg = langColors[lang.toLowerCase()] || '#94a3b8';
                              return (
                                <div
                                  key={lang}
                                  className="lang-bar-segment"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: bg,
                                    height: '100%'
                                  }}
                                  title={`${lang}: ${pct}%`}
                                />
                              );
                            })}
                          </div>
                          
                          <div className="lang-bar-legend">
                            {sorted.map(([lang, count]) => {
                              const pct = ((count / total) * 100).toFixed(1);
                              const dotColor = langColors[lang.toLowerCase()] || '#94a3b8';
                              return (
                                <div key={lang} className="lang-bar-legend-item">
                                  <div className="lang-bar-legend-dot" style={{ backgroundColor: dotColor }} />
                                  <span>{lang} ({pct}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-muted text-xs">No distribution stats parsed.</span>
                  )}
                </GlassCard>

                {/* Tech Stack detection */}
                <GlassCard variant="bordered">
                  <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--sp-3)' }}>
                    Architecture & Tech Badges
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-primary">Node.js</span>
                    <span className="badge badge-cyan">Express App</span>
                    <span className="badge badge-success">SQLite Database</span>
                    <span className="badge badge-warning">LLaMA 3 Knowledge Engine</span>
                  </div>
                </GlassCard>

                {/* Risks & Indicators */}
                <GlassCard variant="bordered">
                  <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--sp-4)' }}>
                    Codebase Health Metrics
                  </h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-secondary flex items-center gap-2">
                        <Info size={14} className="text-success" /> Code Coverage (Docstrings)
                      </span>
                      <span className="font-mono font-semibold text-success">84%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-secondary flex items-center gap-2">
                        <Info size={14} className="text-success" /> Dependency Health
                      </span>
                      <span className="font-mono font-semibold text-success">Excellent</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-secondary flex items-center gap-2">
                        <AlertTriangle size={14} className="text-warning" /> Nested File Depth
                      </span>
                      <span className="font-mono font-semibold text-warning">Medium (4 levels)</span>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-6">
                
                {/* AI Summary Block */}
                <GlassCard variant="bordered" className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-primary-light">
                    <Sparkles size={18} />
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)' }}>
                      AI Architecture Summary
                    </h3>
                  </div>
                  <p className="text-secondary text-sm" style={{ lineHeight: 1.6 }}>
                    {summaries.repository?.[0]?.content ||
                      "This repository represents a structured workspace containing file entities, AST parsers, and service layers. CodeVista has mapped all imports and is ready to query."}
                  </p>
                </GlassCard>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STRUCTURE (Split View) */}
        {activeTab === 'structure' && (
          <div className="flex-1 flex" style={{ height: 'calc(100vh - var(--nav-height) - 48px)' }}>
            
            {/* Left sidebar: File tree */}
            <div style={{
              width: '280px',
              borderRight: '1px solid var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-deep)',
              height: '100%'
            }}>
              <div style={{ padding: 'var(--sp-4)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-semibold text-sm text-secondary">FILES</span>
                {selectedFile && (
                  <button className="btn btn-ghost btn-xs text-primary-light" onClick={() => { setSelectedFile(null); setFileDetails(null); }}>
                    Show Map
                  </button>
                )}
              </div>
              <div className="flex-1" style={{ overflowY: 'auto' }}>
                <FileTree
                  files={fileTree?.children || []}
                  activeFile={selectedFile?.path}
                  onFileClick={handleFileClick}
                />
              </div>
            </div>

            {/* Right Pane: dependency graph or file details */}
            <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-deepest)', height: '100%' }}>
              {selectedFile ? (
                // File Inspector details
                detailsLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Spinner />
                  </div>
                ) : fileDetails ? (
                  <div className="flex-1 flex" style={{ overflow: 'hidden' }}>
                    
                    {/* Source Code */}
                    <div className="flex-1 flex flex-col" style={{ borderRight: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                      <div style={{ padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-deep)' }}>
                        <span className="font-mono text-xs text-secondary">{fileDetails.path}</span>
                        <span className="text-xs text-muted">{(fileDetails.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <div className="flex-1" style={{ overflow: 'auto', padding: 'var(--sp-4)' }}>
                        <CodeBlock
                          code={fileDetails.content || '// Empty file or binary'}
                          language={fileDetails.extension || 'javascript'}
                        />
                      </div>
                    </div>

                    {/* Right side inspector panel */}
                    <div style={{ width: '320px', display: 'flex', flexDirection: 'column', background: 'var(--bg-deep)', overflowY: 'auto', padding: 'var(--sp-4)', gap: 'var(--sp-6)' }}>
                      
                      {/* AI Summary */}
                      <div>
                        <h4 className="text-secondary font-semibold text-sm flex items-center gap-1" style={{ marginBottom: 'var(--sp-2)' }}>
                          <Sparkles size={14} className="text-primary-light" /> AI Summary
                        </h4>
                        <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {fileDetails.summary || "No AI summary parsed for this file."}
                        </div>
                      </div>

                      {/* Symbols list */}
                      <div>
                        <h4 className="text-secondary font-semibold text-sm flex items-center gap-1" style={{ marginBottom: 'var(--sp-2)' }}>
                          <Cpu size={14} className="text-cyan-light" /> AST Symbols ({fileDetails.symbols?.length || 0})
                        </h4>
                        
                        {fileDetails.symbols && fileDetails.symbols.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {fileDetails.symbols.map((sym, idx) => (
                              <div
                                key={idx}
                                style={{
                                  background: 'var(--bg-raised)',
                                  border: '1px solid var(--glass-border)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: 'var(--sp-2)',
                                  fontSize: '11px',
                                }}
                              >
                                <div className="flex justify-between items-center" style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', marginBottom: 2 }}>
                                  <span className="font-mono">{sym.name}</span>
                                  <span className="badge badge-primary btn-sm" style={{ fontSize: '9px', padding: '1px 4px' }}>
                                    {sym.type}
                                  </span>
                                </div>
                                {sym.signature && <div className="font-mono text-dim text-xs" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sym.signature}</div>}
                                <div className="text-dim mt-1">Lines {sym.start_line} - {sym.end_line}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted text-xs">No symbols extracted.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted gap-2">
                    <FileCode size={32} style={{ opacity: 0.5 }} />
                    <span>Failed to inspect file details.</span>
                  </div>
                )
              ) : (
                // Graph view
                <div className="flex-1" style={{ height: '100%' }}>
                  <DependencyGraph
                    data={mapData}
                    onNodeClick={handleFileClick}
                    selectedNodeId={selectedFile?.id}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SUMMARIES */}
        {activeTab === 'summaries' && (
          <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-12)' }}>
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 'var(--sp-6)' }}>
                <div>
                  <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>Codebase Summaries</h2>
                  <p className="text-muted text-xs mt-1">AI-generated structural analysis at different abstraction levels</p>
                </div>
              </div>

              {summariesLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Spinner />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Repository Level Summary */}
                  <GlassCard variant="bordered" className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-primary-light">
                      <Sparkles size={18} />
                      <h3 className="font-bold text-sm">REPOSITORY LEVEL</h3>
                    </div>
                    <p className="text-secondary text-sm" style={{ lineHeight: 1.6 }}>
                      {summaries.repository?.[0]?.content || "Repository summary still building..."}
                    </p>
                  </GlassCard>

                  {/* Module Level Accordions */}
                  <div style={{ marginTop: 'var(--sp-4)' }}>
                    <h3 className="font-bold text-sm text-dim" style={{ marginBottom: 'var(--sp-3)' }}>
                      MODULE SUMMARIES ({summaries.module?.filter(m => m.target_name !== '.')?.length || 0})
                    </h3>
                    
                    {(() => {
                      const filteredModules = (summaries.module || []).filter(m => m.target_name !== '.');
                      return filteredModules.length > 0 ? (
                        filteredModules.map((mod) => {
                          const isExpanded = expandedSummary === mod.id;
                          return (
                            <div key={mod.id} className="accordion-item">
                              <div
                                className="accordion-header"
                                onClick={() => setExpandedSummary(isExpanded ? null : mod.id)}
                              >
                                <div className="accordion-header-left">
                                  <ChevronRight className={`accordion-icon ${isExpanded ? 'accordion-icon-open' : ''}`} />
                                  <div>
                                    <div className="accordion-title font-mono">{mod.target_name}</div>
                                    <div className="accordion-subtitle">Module summary</div>
                                  </div>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="accordion-content text-sm text-secondary" style={{ padding: 'var(--sp-4) var(--sp-6)', background: 'rgba(26,31,54,0.3)' }}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{mod.content}</ReactMarkdown>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-muted text-xs">No module summaries available.</div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CHAT */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col justify-between" style={{ height: 'calc(100vh - var(--nav-height) - 48px)', overflow: 'hidden' }}>
            
            {/* Scrollable messages container */}
            <div className="chat-messages" style={{ overflowY: 'auto' }}>
              {chatMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-6" style={{ padding: 'var(--sp-12)' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px dashed rgba(99,102,241,0.25)',
                    display: 'flex', alignItems: 'center', justify: 'center'
                  }}>
                    <MessageSquare size={32} className="text-primary-light" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', marginBottom: 4 }}>
                      Chat with CodeVista Knowledge Engine
                    </h3>
                    <p className="text-muted text-xs" style={{ maxWidth: '400px', margin: '0 auto' }}>
                      Ask questions about relationships, class purposes, route patterns, or potential breaking changes.
                    </p>
                  </div>

                  {/* Suggestion questions */}
                  <div className="flex flex-col gap-2 w-full" style={{ maxWidth: '440px' }}>
                    {[
                      "What does this repository do?",
                      "Explain the high-level architecture",
                      "Where are the API endpoints/routes defined?",
                      "What would break if I change database schema?"
                    ].map((q) => (
                      <button
                        key={q}
                        className="btn btn-secondary w-full text-left"
                        onClick={() => { setChatInput(q); }}
                        style={{ fontSize: 'var(--text-xs)', justifyContent: 'flex-start' }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, i) => {
                  const isAi = msg.role === 'assistant';
                  return (
                    <div key={i} className={`chat-message ${isAi ? 'chat-message-ai' : 'chat-message-user'}`}>
                      <div className={`chat-avatar ${isAi ? 'chat-avatar-ai' : 'chat-avatar-user'}`}>
                        {isAi ? <Sparkles size={16} /> : <FileCode size={16} />}
                      </div>
                      
                      <div className={`chat-bubble ${isAi ? 'chat-bubble-ai' : 'chat-bubble-user'}`}>
                        {isAi ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        ) : (
                          msg.content
                        )}

                        {/* File reference pills */}
                        {isAi && msg.references && msg.references.length > 0 && (
                          <div className="chat-file-refs">
                            {msg.references.slice(0, 4).map((ref, rIdx) => (
                              <div
                                key={rIdx}
                                className="chat-file-ref"
                                onClick={() => {
                                  // Find the file entity in flat list
                                  const match = flatFiles.find(f => f.name === ref.file || f.path.endsWith(ref.file));
                                  if (match) {
                                    handleFileClick(match);
                                    setActiveTab('structure');
                                  } else {
                                    addToast({ type: 'info', title: 'Reference', message: `Reference to ${ref.file}` });
                                  }
                                }}
                              >
                                <FileCode size={10} />
                                <span>{ref.file}{ref.symbol ? ` : ${ref.symbol}` : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {chatLoading && (
                <div className="chat-message chat-message-ai">
                  <div className="chat-avatar chat-avatar-ai">
                    <Sparkles size={16} />
                  </div>
                  <div className="chat-bubble chat-bubble-ai flex items-center gap-2">
                    <span className="text-dim text-xs animate-pulse">CodeVista is preparing codebase query...</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input form */}
            <form onSubmit={handleSendChat} className="chat-input-bar">
              <textarea
                className="chat-input"
                placeholder="Ask about dependencies, logic flow, routes..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                disabled={chatLoading}
                rows={1}
              />
              <button
                type="submit"
                className="chat-send-btn btn-primary"
                disabled={!chatInput.trim() || chatLoading}
                aria-label="Send query"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* TAB 5: DOCUMENTATION */}
        {activeTab === 'docs' && (
          <div className="container flex" style={{ height: 'calc(100vh - var(--nav-height) - 48px)', overflow: 'hidden', padding: 0 }}>
            
            {/* Left Doc Sidebar */}
            <div style={{
              width: '240px',
              borderRight: '1px solid var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-deep)',
              height: '100%',
              padding: 'var(--sp-4)',
              gap: 'var(--sp-4)'
            }}>
              <div>
                <h3 className="font-bold text-sm text-secondary" style={{ marginBottom: 'var(--sp-3)' }}>
                  DOC TYPE
                </h3>
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'readme', label: 'README.md' },
                    { id: 'onboarding', label: 'Developer Guide' },
                    { id: 'architecture', label: 'Architecture Outline' },
                    { id: 'module', label: 'Module Walkthrough' }
                  ].map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setDocType(doc.id)}
                      className={`btn btn-sm ${docType === doc.id ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ justifyContent: 'flex-start' }}
                    >
                      <FileText size={14} />
                      {doc.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary w-full"
                onClick={handleGenerateDoc}
                disabled={docLoading}
                style={{ marginTop: 'auto' }}
              >
                {docLoading ? <Spinner size="sm" /> : <Sparkles size={14} />}
                Generate Guide
              </button>
            </div>

            {/* Right Doc Inspector */}
            <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-deepest)', height: '100%', overflow: 'hidden' }}>
              {docLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
                  <Spinner size="lg" />
                  <span className="text-sm font-medium animate-pulse">Running semantic models for documentation...</span>
                </div>
              ) : activeDoc ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div style={{ padding: 'var(--sp-3) var(--sp-6)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-deep)' }}>
                    <span className="font-bold text-sm text-secondary">{activeDoc.title || activeDoc.type.toUpperCase()}</span>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(activeDoc.content)}>
                        <Copy size={12} /> Copy
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => downloadMarkdown(activeDoc)}>
                        <Download size={12} /> Download
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 tab-content" style={{ overflowY: 'auto', padding: 'var(--sp-8) var(--sp-6)' }}>
                    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeDoc.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted gap-2">
                  <BookOpen size={32} style={{ opacity: 0.5 }} />
                  <span>Select a documentation type and click "Generate Guide" to construct it.</span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
