import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Link2, Info, FileArchive, CheckCircle } from 'lucide-react';

const Github = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);
import { useApp } from '../context/AppContext';
import api from '../services/api';
import GlassCard from '../components/GlassCard';
import { LoadingOverlay, ProgressBar } from '../components/LoadingStates';

export default function ConnectRepoPage() {
  const [activeTab, setActiveTab] = useState('github'); // 'github' | 'upload'
  const [gitUrl, setGitUrl] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { dispatch, addToast } = useApp();

  const handleConnectGit = async (e) => {
    e.preventDefault();
    if (!gitUrl.trim()) return;

    setLoading(true);
    setLoadingMessage('Cloning repository and starting AST analysis...');

    try {
      const res = await api.connectRepository(gitUrl.trim());
      const repo = res.data;
      
      dispatch({ type: 'ADD_REPOSITORY', payload: repo });
      addToast({
        type: 'success',
        title: 'Connection started',
        message: `Successfully connected ${repo.name}. Running background analysis.`,
      });
      navigate(`/repo/${repo.id}`);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Connection failed',
        message: err.message || 'Check the URL and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'zip') {
      addToast({
        type: 'error',
        title: 'Invalid file format',
        message: 'Please upload a standard ZIP archive (.zip) only.',
      });
      return;
    }
    setUploadFile(file);
    handleUpload(file);
  };

  const handleUpload = async (file) => {
    setLoading(true);
    setLoadingMessage('Uploading source code archive...');
    setUploadProgress(10);

    // Simulate progress updates for a smoother visual experience
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval);
          return 85;
        }
        return prev + 15;
      });
    }, 400);

    try {
      const res = await api.uploadRepository(file);
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      const repo = res.data;
      dispatch({ type: 'ADD_REPOSITORY', payload: repo });
      
      addToast({
        type: 'success',
        title: 'Upload successful',
        message: `Extracted ${repo.name}. Commencing structural parsing.`,
      });
      
      setTimeout(() => {
        navigate(`/repo/${repo.id}`);
      }, 500);
    } catch (err) {
      clearInterval(progressInterval);
      setUploadFile(null);
      setUploadProgress(0);
      addToast({
        type: 'error',
        title: 'Upload failed',
        message: err.message || 'An error occurred during ZIP extraction.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      {loading && <LoadingOverlay message={loadingMessage} />}
      
      <div className="container" style={{ maxWidth: '640px', paddingBottom: 'var(--sp-12)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-8)', paddingTop: 'var(--sp-6)' }}>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)', letterSpacing: '-0.02em' }}>
            Connect Repository
          </h1>
          <p className="text-muted" style={{ marginTop: '4px', fontSize: 'var(--text-sm)' }}>
            Link your GitHub project or upload a codebase to build a conversational engine
          </p>
        </div>

        {/* Custom Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--glass-border)',
          marginBottom: 'var(--sp-6)',
          justifyContent: 'center',
        }}>
          <button
            className={`connect-tab ${activeTab === 'github' ? 'connect-tab-active' : ''}`}
            onClick={() => setActiveTab('github')}
            style={{ width: '50%' }}
          >
            <Github size={18} />
            GitHub Repository
          </button>
          <button
            className={`connect-tab ${activeTab === 'upload' ? 'connect-tab-active' : ''}`}
            onClick={() => setActiveTab('upload')}
            style={{ width: '50%' }}
          >
            <Upload size={18} />
            ZIP Source Archive
          </button>
        </div>

        {/* Tab Contents */}
        <GlassCard variant="bordered">
          {activeTab === 'github' ? (
            <form onSubmit={handleConnectGit} className="flex flex-col gap-5">
              <div>
                <label className="input-label" htmlFor="git-url">
                  Git Repository HTTPS/SSH URL
                </label>
                <div className="input-with-icon">
                  <Link2 className="input-icon" />
                  <input
                    id="git-url"
                    type="text"
                    className="input-field"
                    placeholder="https://github.com/username/project-repo"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    required
                    aria-label="Git Repository URL"
                  />
                </div>
                <div className="flex gap-2 items-start text-xs text-dim" style={{ marginTop: 'var(--sp-3)', lineHeight: 1.5 }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--primary-light)' }} />
                  <span>
                    CodeVista supports cloning public GitHub repositories. Make sure the URL is formatted correctly (e.g. ends in <code>.git</code> or is a standard github.com root project URL).
                  </span>
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={!gitUrl.trim() || loading}
                style={{ marginTop: 'var(--sp-2)' }}
              >
                <Github size={16} />
                Connect & Analyze Codebase
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-6">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".zip"
                style={{ display: 'none' }}
              />

              <div
                className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon">
                  <FileArchive size={28} />
                </div>
                <h3 className="dropzone-title">Drag & Drop ZIP file</h3>
                <p className="dropzone-desc">
                  Drag your source project ZIP archive here or{' '}
                  <span className="dropzone-browse">browse local files</span>
                </p>
                <span className="text-dim text-xs" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
                  Maximum file size: 100 MB (.zip only)
                </span>
              </div>

              {uploadFile && (
                <div className="flex flex-col gap-2 p-4" style={{ background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-center gap-2 text-sm">
                    <FileArchive size={16} className="text-primary-light" />
                    <span className="font-semibold text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {uploadFile.name}
                    </span>
                    <span className="text-muted font-mono text-xs">
                      {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                  {uploadProgress > 0 && (
                    <ProgressBar progress={uploadProgress} label="Uploading and extracting archive..." />
                  )}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
