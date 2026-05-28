import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Plus, Trash2, Calendar, FileCode, Cpu, Globe } from 'lucide-react';

const Github = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
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
import StatusBadge from '../components/StatusBadge';
import { SkeletonCard } from '../components/LoadingStates';

export default function DashboardPage() {
  const { state, dispatch, addToast } = useApp();
  const { repositories, repoLoading, repoError } = state;
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const fetchRepos = async () => {
      dispatch({ type: 'SET_REPO_LOADING', payload: true });
      try {
        const res = await api.getRepositories();
        if (active) {
          dispatch({ type: 'SET_REPOSITORIES', payload: res.data || [] });
        }
      } catch (err) {
        if (active) {
          dispatch({ type: 'SET_REPO_ERROR', payload: err.message });
          addToast({
            type: 'error',
            title: 'Failed to fetch repositories',
            message: err.message,
          });
        }
      }
    };
    fetchRepos();
    return () => { active = false; };
  }, [dispatch, addToast]);

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // prevent card click navigation
    if (!window.confirm('Are you sure you want to delete this repository from CodeVista? This will remove all files, symbols, relationships, and history.')) {
      return;
    }
    
    try {
      await api.deleteRepository(id);
      dispatch({ type: 'REMOVE_REPOSITORY', payload: id });
      addToast({
        type: 'success',
        title: 'Repository deleted',
        message: 'Successfully removed from CodeVista.',
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Deletion failed',
        message: err.message,
      });
    }
  };

  const filteredRepos = repositories.filter((repo) => {
    const nameMatch = repo.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const urlMatch = repo.url?.toLowerCase().includes(searchTerm.toLowerCase());
    return nameMatch || urlMatch;
  });

  const getLanguageArray = (langStats) => {
    if (!langStats) return [];
    if (typeof langStats === 'object') return Object.keys(langStats).slice(0, 3);
    try {
      const parsed = JSON.parse(langStats);
      return Object.keys(parsed).slice(0, 3);
    } catch {
      return [];
    }
  };

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingBottom: 'var(--sp-12)' }}>
        {/* Header Block */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--sp-4)',
          marginBottom: 'var(--sp-8)',
          paddingTop: 'var(--sp-6)',
        }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)', letterSpacing: '-0.02em' }}>
              Your Codebases
            </h1>
            <p className="text-muted" style={{ marginTop: '2px', fontSize: 'var(--text-sm)' }}>
              Explore, visual, and query your knowledge systems
            </p>
          </div>
          <Link to="/connect" className="btn btn-primary">
            <Plus size={16} />
            Connect Repository
          </Link>
        </div>

        {/* Filter and Search */}
        {repositories.length > 0 && (
          <div className="input-with-icon" style={{ maxWidth: '400px', marginBottom: 'var(--sp-6)' }}>
            <Search className="input-icon" />
            <input
              type="text"
              className="input-field"
              placeholder="Search codebases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search repositories"
            />
          </div>
        )}

        {/* Repository Grid */}
        {repoLoading ? (
          <div className="repo-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--sp-6)' }}>
            <SkeletonCard count={3} />
          </div>
        ) : repoError && repositories.length === 0 ? (
          <GlassCard variant="bordered" className="text-center flex flex-col gap-4 items-center justify-center" style={{ padding: 'var(--sp-12) 0' }}>
            <div className="text-danger" style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)' }}>
              Failed to load repositories
            </div>
            <p className="text-muted" style={{ maxWidth: '400px' }}>
              {repoError}
            </p>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>
              Retry Request
            </button>
          </GlassCard>
        ) : filteredRepos.length === 0 ? (
          searchTerm ? (
            <GlassCard variant="bordered" className="text-center" style={{ padding: 'var(--sp-12) 0' }}>
              <h3 className="text-muted" style={{ fontWeight: 'var(--weight-medium)', marginBottom: 'var(--sp-2)' }}>
                No search results found
              </h3>
              <p className="text-dim text-sm">
                No connected repositories matched your search query "{searchTerm}"
              </p>
            </GlassCard>
          ) : (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <GlassCard
                variant="bordered"
                className="text-center flex flex-col items-center justify-center gap-6"
                style={{ padding: 'var(--sp-16) var(--sp-6)' }}
              >
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: 'var(--radius-xl)',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px dashed rgba(99,102,241,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <FileCode size={36} className="text-primary-light" />
                </div>
                <div>
                  <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', marginBottom: 'var(--sp-2)' }}>
                    Connect Your First Codebase
                  </h2>
                  <p className="text-muted text-sm" style={{ maxWidth: '460px', margin: '0 auto', lineHeight: 1.6 }}>
                    CodeVista needs a repository to parse and analyze before you can query your codebase or generate premium documentation. Start by linking a public GitHub repository.
                  </p>
                </div>
                <Link to="/connect" className="btn btn-primary btn-lg">
                  <Plus size={18} />
                  Connect Repository
                </Link>
              </GlassCard>
            </motion.div>
          )
        ) : (
          <div className="repo-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--sp-6)' }}>
            {filteredRepos.map((repo, idx) => {
              const languages = getLanguageArray(repo.language_stats);
              const formattedDate = repo.created_at
                ? new Date(repo.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Unknown';

              const isGithub = repo.url && repo.url.includes('github.com');

              return (
                <motion.div
                  key={repo.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  onClick={() => navigate(`/repo/${repo.id}`)}
                  className="repo-card"
                >
                  <div className="repo-card-header">
                    <span className="repo-card-name" title={repo.name}>
                      {repo.name}
                    </span>
                    <StatusBadge status={repo.status} />
                  </div>

                  <p className="repo-card-desc">
                    {repo.url ? (
                      <span className="flex items-center gap-1 font-mono text-xs text-dim" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isGithub ? <Github size={12} style={{ flexShrink: 0 }} /> : <Globe size={12} style={{ flexShrink: 0 }} />}
                        {repo.url}
                      </span>
                    ) : (
                      'Uploaded Source Archive'
                    )}
                  </p>

                  {languages.length > 0 && (
                    <div className="repo-card-langs">
                      {languages.map((lang) => (
                        <span key={lang} className="badge badge-primary font-mono text-xs">
                          {lang.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="repo-card-meta">
                    <div className="repo-card-meta-item">
                      <FileCode size={14} />
                      <span>{repo.total_files || 0} files</span>
                    </div>
                    {repo.total_symbols > 0 && (
                      <div className="repo-card-meta-item">
                        <Cpu size={14} />
                        <span>{repo.total_symbols} symbols</span>
                      </div>
                    )}
                    <div className="repo-card-meta-item" style={{ marginLeft: 'auto' }}>
                      <Calendar size={14} />
                      <span>{formattedDate}</span>
                    </div>
                    <button
                      className="btn btn-ghost btn-icon text-danger"
                      onClick={(e) => handleDelete(e, repo.id)}
                      aria-label="Delete repository"
                      style={{ padding: 4, marginLeft: 4 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
