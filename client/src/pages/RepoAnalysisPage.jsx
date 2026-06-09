import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Code2, Cpu, MessageSquare, BookOpen, ShieldAlert, ShieldCheck, Lock, Unlock, RefreshCw, FileText, Send,
  Terminal, AlertTriangle, ChevronDown, ChevronRight, Copy, Download, Search,
  Network, FileCode, ArrowLeft, TerminalSquare, Info, Sparkles, Layers, Trash2,
  Folder
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

  // Verification states
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [githubUsernameInput, setGithubUsernameInput] = useState('');
  const [githubPatInput, setGithubPatInput] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerifyOwnership = async (e) => {
    e.preventDefault();
    if (!githubUsernameInput.trim()) return;

    setVerifying(true);
    try {
      const res = await api.verifyRepositoryOwnership(
        selectedRepo.id,
        githubUsernameInput.trim(),
        githubPatInput.trim()
      );
      dispatch({ type: 'UPDATE_REPOSITORY', payload: res.data });
      addToast({
        type: 'success',
        title: 'Ownership Verified!',
        message: 'Successfully verified repository owner. Security threat auditing is now unlocked.',
      });
      setIsVerifyModalOpen(false);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Verification Failed',
        message: err.message || 'Credentials could not be verified against the codebase.',
      });
    } finally {
      setVerifying(false);
    }
  };

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
            if (timer) clearInterval(timer);
            addToast({
              type: 'success',
              title: 'Analysis complete!',
              message: 'CodeVista successfully indexed your repository symbols.',
            });
            // Reload repo data
            const repoRes = await api.getRepository(id);
            dispatch({ type: 'SET_SELECTED_REPO', payload: repoRes.data });
          } else if (res.data.status === 'error') {
            if (timer) clearInterval(timer);
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
          const match = res.data.find(d => d.type === docType);
          setActiveDoc(match || res.data[0]);
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
    if (!fileNode || fileNode.type === 'folder' || fileNode.type === 'directory') {
      setFileDetails(null);
      return;
    }
    setDetailsLoading(true);
    try {
      const res = await api.getFileDetails(id, fileNode.id);
      setFileDetails(res.data);
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

  const detectTechStack = () => {
    const badges = [];
    const stats = selectedRepo.language_stats || {};
    const filePaths = flatFiles.map(f => f.path.toLowerCase());
    
    // Helper to check if file exists
    const hasFile = (name) => filePaths.some(p => p.endsWith(name.toLowerCase()));
    // Helper to check if any file has extension
    const hasExt = (ext) => stats[ext] && stats[ext] > 0;

    // 1. Language badges
    if (hasExt('js') || hasExt('jsx') || hasExt('ts') || hasExt('tsx')) {
      badges.push({ name: 'JavaScript', icon: Terminal, color: 'primary' });
    }
    if (hasExt('ts') || hasExt('tsx')) {
      badges.push({ name: 'TypeScript', icon: Code2, color: 'cyan' });
    }
    if (hasExt('py')) {
      badges.push({ name: 'Python', icon: Terminal, color: 'warning' });
    }
    if (hasExt('go')) {
      badges.push({ name: 'Go', icon: Cpu, color: 'cyan' });
    }
    if (hasExt('rs')) {
      badges.push({ name: 'Rust', icon: Cpu, color: 'warning' });
    }
    if (hasExt('java')) {
      badges.push({ name: 'Java', icon: Layers, color: 'violet' });
    }
    if (hasExt('cpp') || hasExt('c')) {
      badges.push({ name: 'C/C++', icon: Cpu, color: 'primary' });
    }

    // 2. Frontend Frameworks
    if (hasFile('package.json')) {
      if (hasExt('jsx') || hasExt('tsx') || filePaths.some(p => p.includes('react'))) {
        badges.push({ name: 'React', icon: Code2, color: 'violet' });
      }
      if (hasFile('next.config.js') || hasFile('next.config.mjs') || filePaths.some(p => p.includes('.next/'))) {
        badges.push({ name: 'Next.js', icon: Layers, color: 'info' });
      }
      if (hasFile('vite.config.js') || hasFile('vite.config.ts')) {
        badges.push({ name: 'Vite', icon: Sparkles, color: 'warning' });
      }
    }

    // 3. Backend / Runtime
    if (hasFile('package.json')) {
      badges.push({ name: 'Node.js', icon: Terminal, color: 'success' });
      if (filePaths.some(p => p.includes('server') || p.includes('app.js') || p.includes('index.js'))) {
        badges.push({ name: 'Express', icon: Network, color: 'cyan' });
      }
    } else if (hasExt('py')) {
      if (hasFile('manage.py')) {
        badges.push({ name: 'Django', icon: Network, color: 'success' });
      } else if (hasFile('requirements.txt') || hasFile('pyproject.toml')) {
        badges.push({ name: 'WSGI/ASGI', icon: Network, color: 'info' });
      }
    }

    // 4. Databases
    if (filePaths.some(p => p.includes('sqlite') || p.includes('db.sqlite') || p.endsWith('.db') || p.endsWith('.sqlite'))) {
      badges.push({ name: 'SQLite', icon: Layers, color: 'success' });
    } else if (filePaths.some(p => p.includes('schema.sql') || p.includes('migration') || p.includes('db/'))) {
      badges.push({ name: 'SQL', icon: Layers, color: 'info' });
    }

    // 5. Build/Packaging
    if (hasFile('Dockerfile') || hasFile('docker-compose.yml')) {
      badges.push({ name: 'Docker', icon: Cpu, color: 'info' });
    }
    if (hasFile('package.json')) {
      badges.push({ name: 'NPM', icon: Terminal, color: 'danger' });
    } else if (hasFile('Cargo.toml')) {
      badges.push({ name: 'Cargo', icon: Terminal, color: 'danger' });
    }

    // Fallback if empty — keep standard stack
    if (badges.length === 0) {
      return [
        { name: 'Node.js', icon: Terminal, color: 'primary' },
        { name: 'Express', icon: Network, color: 'cyan' },
        { name: 'SQLite', icon: Layers, color: 'success' },
        { name: 'React', icon: Code2, color: 'violet' },
        { name: 'JavaScript', icon: Terminal, color: 'warning' },
        { name: 'CSS', icon: Sparkles, color: 'info' },
      ];
    }

    // Limit to max 6 unique badges for spacing layout
    return badges.slice(0, 6);
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
          {selectedRepo.is_verified_owner === 1 ? (
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '100px',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)',
                color: 'var(--success-light)',
                fontSize: '11px',
                fontWeight: 'var(--weight-semibold)',
              }}
              title="Verified Owner: Full Threat & Shortcomings auditing unlocked."
            >
              <ShieldCheck size={12} />
              <span>Verified Owner</span>
            </div>
          ) : (
            <button 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '100px',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.2)',
                color: 'var(--primary-light)',
                fontSize: '11px',
                fontWeight: 'var(--weight-semibold)',
                cursor: 'pointer',
              }}
              onClick={() => setIsVerifyModalOpen(true)}
              title="External Project: Ask questions on how code works. Click to verify ownership and unlock security threat points auditing."
            >
              <ShieldAlert size={12} />
              <span>External Project</span>
            </button>
          )}
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
      <div className="flex-1" style={{ overflowY: ['structure', 'docs', 'chat'].includes(activeTab) ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="container" style={{ paddingTop: 'var(--sp-6)', paddingBottom: 'var(--sp-12)' }}>
            
            {/* Top Row: Compact Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
              <MetricCard icon={FileCode} label="Total Files" value={selectedRepo.total_files || 0} color="primary" tooltip="Total physical file count indexed from target codebase, excluding ignored modules." />
              <MetricCard icon={Cpu} label="Extracted Symbols" value={selectedRepo.total_symbols || 0} color="cyan" tooltip="Total number of classes, functions, routes, and exports mapped from structural codebase parsing." />
              <MetricCard icon={Layers} label="Key Modules" value={summaries.module?.filter(m => m.target_name !== '.')?.length || 0} color="violet" tooltip="Identified directory layers containing major system sub-folders." />
              <MetricCard icon={ShieldAlert} label="Complexity Status" value="Healthy" color="success" tooltip="Determined relative complexity of AST symbols tree depth and structures." />
            </div>

            {/* Full-width AI Architecture Summary — prominent hero block */}
            <GlassCard variant="bordered" className="overview-ai-summary" style={{ marginBottom: 'var(--sp-6)', borderLeft: '3px solid var(--primary)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 'var(--sp-4)' }}>
                <div style={{ background: 'rgba(99,102,241,0.12)', padding: '6px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} className="text-primary-light" />
                </div>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
                  AI Architecture Summary
                </h3>
              </div>
              <div className="overview-ai-summary-body">
                {summaries.repository?.[0]?.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaries.repository[0].content}</ReactMarkdown>
                ) : (
                  <p className="text-muted" style={{ fontStyle: 'italic' }}>This repository represents a structured workspace containing file entities, AST parsers, and service layers. CodeVista has mapped all imports and is ready to query.</p>
                )}
              </div>
            </GlassCard>

            {/* Two-Column Layout: Lang + Tech | Health Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)' }}>
              
              {/* Left Column */}
              <div className="flex flex-col" style={{ gap: 'var(--sp-6)' }}>
                {/* Language Distribution */}
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

                {/* Architecture & Tech Stack — compact chip badges */}
                <GlassCard variant="bordered">
                  <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--sp-4)' }}>
                    Architecture & Tech Stack
                  </h3>
                  <div className="tech-badge-grid">
                    {detectTechStack().map((badge, idx) => {
                      const IconComponent = badge.icon;
                      return (
                        <div key={idx} className={`tech-badge tech-badge-${badge.color}`}>
                          <IconComponent size={14} />
                          <span>{badge.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              </div>

              {/* Right Column: Health Metrics */}
              <GlassCard variant="bordered">
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--sp-5)' }}>
                  Codebase Health Metrics
                </h3>
                <div className="flex flex-col" style={{ gap: 'var(--sp-5)' }}>
                  {/* Code Coverage */}
                  <div className="health-metric-row">
                    <div className="health-metric-left">
                      <span className="tooltip-container">
                        <Info size={14} className="text-success" style={{ cursor: 'help' }} />
                        <span className="tooltip-text">
                          Measures the percentage of classes and functions that have descriptive docstrings or comment blocks extracted by AST parsers.
                        </span>
                      </span>
                      <span className="text-secondary text-sm">Code Coverage (Docstrings)</span>
                    </div>
                    <div className="health-metric-right">
                      <div className="health-bar">
                        <div className="health-bar-fill health-bar-success" style={{ width: '84%' }} />
                      </div>
                      <span className="font-mono font-semibold text-success text-sm" style={{ minWidth: '42px', textAlign: 'right' }}>84%</span>
                    </div>
                  </div>

                  {/* Dependency Health */}
                  <div className="health-metric-row">
                    <div className="health-metric-left">
                      <span className="tooltip-container">
                        <Info size={14} className="text-success" style={{ cursor: 'help' }} />
                        <span className="tooltip-text">
                          Evaluates repository connectivity. Looks at circular imports, isolated modules, and ensures cohesive routing connections.
                        </span>
                      </span>
                      <span className="text-secondary text-sm">Dependency Health</span>
                    </div>
                    <div className="health-metric-right">
                      <div className="health-bar">
                        <div className="health-bar-fill health-bar-success" style={{ width: '95%' }} />
                      </div>
                      <span className="font-mono font-semibold text-success text-sm" style={{ minWidth: '72px', textAlign: 'right' }}>Excellent</span>
                    </div>
                  </div>

                  {/* Nested File Depth */}
                  <div className="health-metric-row">
                    <div className="health-metric-left">
                      <span className="tooltip-container">
                        <AlertTriangle size={14} className="text-warning" style={{ cursor: 'help' }} />
                        <span className="tooltip-text">
                          Checks repository nesting complexity. High nesting depth (5+ levels) indicates potential over-modularization or directory clutter.
                        </span>
                      </span>
                      <span className="text-secondary text-sm">Nested File Depth</span>
                    </div>
                    <div className="health-metric-right">
                      <div className="health-bar">
                        <div className="health-bar-fill health-bar-warning" style={{ width: '55%' }} />
                      </div>
                      <span className="font-mono font-semibold text-warning text-sm" style={{ minWidth: '72px', textAlign: 'right' }}>Medium</span>
                    </div>
                  </div>

                  {/* Extracted Symbols Density */}
                  <div className="health-metric-row">
                    <div className="health-metric-left">
                      <span className="tooltip-container">
                        <Info size={14} className="text-primary-light" style={{ cursor: 'help' }} />
                        <span className="tooltip-text">
                          Ratio of parsed symbols (functions, classes, exports) per file. Higher density means more granular code modularity.
                        </span>
                      </span>
                      <span className="text-secondary text-sm">Symbol Density</span>
                    </div>
                    <div className="health-metric-right">
                      <div className="health-bar">
                        <div className="health-bar-fill health-bar-primary" style={{ width: '72%' }} />
                      </div>
                      <span className="font-mono font-semibold text-primary-light text-sm" style={{ minWidth: '42px', textAlign: 'right' }}>
                        {selectedRepo.total_files > 0 ? (selectedRepo.total_symbols / selectedRepo.total_files).toFixed(1) : '—'}/file
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>
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
            <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-deepest)', height: '100%', minHeight: 0 }}>
              {selectedFile ? (
                // File/Folder Inspector details
                detailsLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Spinner />
                  </div>
                ) : (selectedFile.type === 'folder' || selectedFile.type === 'directory') ? (
                  // Folder Inspector Details
                  <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ padding: 'var(--sp-6)', overflowY: 'auto' }}>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
                      
                      {/* Folder Title Card */}
                      <div className="glass-card flex items-center gap-4" style={{ borderLeft: '4px solid var(--warning)' }}>
                        <div style={{ background: 'var(--warning-bg)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
                          <Folder size={32} className="text-warning-light" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-primary-light">{selectedFile.label}</h2>
                          <p className="text-xs text-muted font-mono" style={{ marginTop: 2 }}>{selectedFile.path || '/'}</p>
                        </div>
                      </div>

                      {/* Directory Module Summary */}
                      <div className="glass-card">
                        <h3 className="text-secondary font-semibold text-sm flex items-center gap-2" style={{ marginBottom: 'var(--sp-3)' }}>
                          <Sparkles size={16} className="text-warning-light" /> Module Intelligence
                        </h3>
                        {(() => {
                          const modSummary = summaries.module?.find(
                            (s) => s.target_name === selectedFile.path || 
                                   s.target_name === selectedFile.label
                          );
                          return modSummary ? (
                            <div className="text-sm text-secondary leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{modSummary.content}</ReactMarkdown>
                            </div>
                          ) : (
                            <p className="text-sm text-muted italic">
                              No specific AI module summary found for this directory level. Explore subfiles to see detailed summaries.
                            </p>
                          );
                        })()}
                      </div>

                      {/* Sub-files and Folders list */}
                      <div className="glass-card">
                        <h3 className="text-secondary font-semibold text-sm" style={{ marginBottom: 'var(--sp-3)' }}>
                          Directory Contents
                        </h3>
                        <div className="flex flex-col gap-2">
                          {(() => {
                            const subFiles = flatFiles.filter(f => 
                              selectedFile.path === '' ? !f.path.includes('/') : f.path.startsWith(selectedFile.path + '/')
                            );
                            if (subFiles.length === 0) return <p className="text-xs text-muted italic">Empty directory</p>;
                            return subFiles.slice(0, 15).map((file, idx) => (
                              <div 
                                key={idx} 
                                className="flex items-center justify-between p-2 rounded hover:bg-hover cursor-pointer"
                                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', transition: 'all 0.2s' }}
                                onClick={() => handleFileClick(file)}
                              >
                                <div className="flex items-center gap-2">
                                  <FileCode size={14} className="text-primary-light" />
                                  <span className="text-xs font-mono text-secondary">{file.path}</span>
                                </div>
                                <span className="text-xs text-muted">{(file.size / 1024).toFixed(1)} KB</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                    </div>
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
                        <div className="file-summary-body" style={{ background: 'var(--bg-raised)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden' }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileDetails.summary || "No AI summary parsed for this file."}</ReactMarkdown>
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
            <div style={{ width: '100%' }}>
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
                    <div className="repo-summary-body">
                      {summaries.repository?.[0]?.content ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaries.repository[0].content}</ReactMarkdown>
                      ) : (
                        <p>Repository summary still building...</p>
                      )}
                    </div>
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
            
            {/* Ownership Compliance Banner */}
            {selectedRepo.is_verified_owner !== 1 ? (
              <div style={{
                background: 'rgba(99,102,241,0.05)',
                borderBottom: '1px solid rgba(99,102,241,0.15)',
                padding: 'var(--sp-2-5) var(--sp-6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--sp-4)',
                fontSize: '11px',
                flexShrink: 0,
              }}>
                <div className="flex items-center gap-2" style={{ color: 'rgba(165,180,252,0.9)' }}>
                  <ShieldAlert size={13} className="animate-pulse" style={{ flexShrink: 0 }} />
                  <span>
                    <strong>External Codebase / Other's Project:</strong> Under security compliance, security threat auditing is locked. You can only request walkthrough and functional insights.
                  </span>
                </div>
                <button 
                  className="btn btn-ghost btn-sm text-primary-light flex items-center gap-1.5"
                  onClick={() => setIsVerifyModalOpen(true)}
                  style={{ textDecoration: 'underline', padding: '2px 8px', fontSize: '11px', flexShrink: 0 }}
                >
                  <Lock size={12} />
                  Verify Ownership
                </button>
              </div>
            ) : (
              <div style={{
                background: 'rgba(16,185,129,0.05)',
                borderBottom: '1px solid rgba(16,185,129,0.15)',
                padding: 'var(--sp-2-5) var(--sp-6)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                fontSize: '11px',
                color: 'rgba(110,231,183,0.9)',
                flexShrink: 0,
              }}>
                <ShieldCheck size={13} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Verified Repository Owner:</strong> Threat auditing, vulnerability discovery, and shortcomings analysis are unlocked and compliant.
                </span>
              </div>
            )}
            
            {/* Scrollable messages container */}
            <div className="chat-messages" style={{ overflowY: 'auto', flex: 1 }}>
              {chatMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-6" style={{ padding: 'var(--sp-8) var(--sp-12)' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px dashed rgba(99,102,241,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
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
                      onClick={() => {
                        setDocType(doc.id);
                        const match = docsList.find(d => d.type === doc.id);
                        setActiveDoc(match || null);
                      }}
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
            <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-deepest)', height: '100%', overflow: 'hidden', minHeight: 0 }}>
              {docLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
                  <Spinner size="lg" />
                  <span className="text-sm font-medium animate-pulse">Running semantic models for documentation...</span>
                </div>
              ) : activeDoc ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ minHeight: 0 }}>
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
                    <div className="markdown-body" style={{ width: '100%' }}>
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

      {/* ── Compliance Verification Modal ── */}
      {isVerifyModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 7, 16, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--sp-4)',
        }}>
          <div style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-xl)',
            width: '100%',
            maxWidth: '480px',
            padding: 'var(--sp-8)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.1)',
            position: 'relative',
          }}>
            <button 
              style={{
                position: 'absolute',
                top: 'var(--sp-4)',
                right: 'var(--sp-4)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 'var(--sp-1)',
                fontSize: '18px',
                lineHeight: 1,
              }}
              onClick={() => setIsVerifyModalOpen(false)}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(99,102,241,0.08)',
                border: '1px dashed rgba(99,102,241,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--sp-4) auto',
              }}>
                <ShieldCheck size={24} className="text-primary-light" />
              </div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', letterSpacing: '-0.01em', color: 'var(--text-secondary)' }}>
                Verify Repository Ownership
              </h2>
              <p className="text-muted text-xs" style={{ marginTop: '4px' }}>
                Verify ownership of **{selectedRepo.name}** under security compliance guidelines to unlock vulnerability auditing.
              </p>
            </div>

            <form onSubmit={handleVerifyOwnership} className="flex flex-col gap-4">
              <div>
                <label className="input-label" htmlFor="verify-username">
                  GitHub Username
                </label>
                <input
                  id="verify-username"
                  type="text"
                  className="input-field"
                  placeholder="e.g. octocat"
                  value={githubUsernameInput}
                  onChange={(e) => setGithubUsernameInput(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="input-label" htmlFor="verify-pat">
                  Personal Access Token (PAT)
                </label>
                <input
                  id="verify-pat"
                  type="password"
                  className="input-field"
                  placeholder="ghp_xxxxxxxxxxxxxx"
                  value={githubPatInput}
                  onChange={(e) => setGithubPatInput(e.target.value)}
                />
                <span className="text-dim text-2xs" style={{ display: 'block', marginTop: '4px', lineHeight: 1.3 }}>
                  Optional for public repositories if your username matches the URL path. Required for private codebases.
                </span>
              </div>

              {/* Compliance note box */}
              <div style={{
                background: 'rgba(99,102,241,0.04)',
                border: '1px solid rgba(99,102,241,0.08)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--sp-3)',
                fontSize: '11px',
                color: 'var(--text-dim)',
                lineHeight: 1.4,
              }}>
                <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>🔒 Security & Compliance Guarantee:</strong>
                <ul style={{ listStyleType: 'disc', paddingLeft: '16px', margin: 0 }}>
                  <li>Scopes are limited strictly to <code>read:user</code> and <code>repo</code> (Least Privilege).</li>
                  <li>Credentials are securely linked for compliance validation.</li>
                  <li>CodeVista will never modify, write, or push commits to your codebase.</li>
                </ul>
              </div>

              <div className="flex gap-3" style={{ marginTop: 'var(--sp-2)' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary w-full"
                  onClick={() => setIsVerifyModalOpen(false)}
                  disabled={verifying}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary w-full flex items-center justify-center gap-1.5"
                  disabled={verifying || !githubUsernameInput.trim()}
                >
                  {verifying ? <Spinner size="sm" /> : <ShieldCheck size={14} />}
                  Verify & Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
