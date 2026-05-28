import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Code2, GitFork, MessageSquare, BookOpen, ShieldAlert, Cpu, Check, Zap, Users, Globe } from 'lucide-react';
import GlassCard from '../components/GlassCard';

export default function LandingPage() {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <div className="page-wrapper" style={{ overflow: 'hidden' }}>
      {/* Hero Section */}
      <section className="section" style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', position: 'relative' }}>
        {/* Glow Effects */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80vw',
          height: '60vh',
          background: 'var(--gradient-glow)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex flex-col items-center text-center gap-6" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="badge badge-primary"
            >
              <Zap size={12} />
              <span>Introducing CodeVista v1.0</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
                fontWeight: 'var(--weight-extrabold)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              Understand Any Codebase{' '}
              <span style={{ background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                in Minutes
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-secondary"
              style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}
            >
              Stop wasting hours manually tracing import graphs. CodeVista reads your repository, builds a deep code-aware index, and lets you chat with your code.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex gap-4"
              style={{ marginTop: 'var(--sp-4)' }}
            >
              <Link to="/connect" className="btn btn-primary btn-lg">
                Get Started Free
              </Link>
              <Link to="/dashboard" className="btn btn-secondary btn-lg">
                View Dashboard
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="section section-sm bg-base" style={{ borderTop: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)' }}>
        <div className="container">
          <div className="text-center" style={{ marginBottom: 'var(--sp-12)' }}>
            <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)' }}>Designed for Engineers & Tech Leads</h2>
            <p className="text-muted" style={{ marginTop: 'var(--sp-2)' }}>Say goodbye to long onboardings and mysterious dependencies.</p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 'var(--sp-6)',
            }}
          >
            <GlassCard variant="hover" animate={false} className="flex flex-col gap-3">
              <div className="metric-card-icon metric-card-icon-cyan"><GitFork size={20} /></div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>Repository Analysis</h3>
              <p className="text-muted text-sm">Clone or upload standard archives to run a deep, AST-level codebase analysis in seconds.</p>
            </GlassCard>

            <GlassCard variant="hover" animate={false} className="flex flex-col gap-3">
              <div className="metric-card-icon"><Code2 size={20} /></div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>Full Code Parsing</h3>
              <p className="text-muted text-sm">Babel AST analysis extracts all classes, functions, route definitions, imports, and variables.</p>
            </GlassCard>

            <GlassCard variant="hover" animate={false} className="flex flex-col gap-3">
              <div className="metric-card-icon metric-card-icon-violet"><Cpu size={20} /></div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>Interactive Graphing</h3>
              <p className="text-muted text-sm">Visualize complex file connections and circular imports inside an elegant custom React Flow map.</p>
            </GlassCard>

            <GlassCard variant="hover" animate={false} className="flex flex-col gap-3">
              <div className="metric-card-icon metric-card-icon-success"><MessageSquare size={20} /></div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>AI Code Chat</h3>
              <p className="text-muted text-sm">Chat with LLaMA-powered AI model. Answers are backed by actual code references and file links.</p>
            </GlassCard>

            <GlassCard variant="hover" animate={false} className="flex flex-col gap-3">
              <div className="metric-card-icon metric-card-icon-warning"><BookOpen size={20} /></div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>Auto-Documentation</h3>
              <p className="text-muted text-sm">Instantly generate onboarding guides, architecture overviews, and formatted README files.</p>
            </GlassCard>

            <GlassCard variant="hover" animate={false} className="flex flex-col gap-3">
              <div className="metric-card-icon metric-card-icon-danger"><ShieldAlert size={20} /></div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>Architecture Risk Review</h3>
              <p className="text-muted text-sm">Spot overly complex structures, circular dependencies, and undocumented modules automatically.</p>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section">
        <div className="container">
          <div className="text-center" style={{ marginBottom: 'var(--sp-16)' }}>
            <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)' }}>Three Steps to Clarity</h2>
            <p className="text-muted" style={{ marginTop: 'var(--sp-2)' }}>How CodeVista processes and explains your project.</p>
          </div>

          <div className="flex gap-8 justify-between flex-col md:flex-row items-stretch">
            <div className="flex-1 flex flex-col items-center text-center gap-4">
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'var(--weight-bold)', color: 'var(--primary-light)', border: '1px solid var(--glass-border-light)' }}>
                1
              </div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>Connect Repository</h3>
              <p className="text-muted text-sm">Enter any public GitHub URL or upload a ZIP archive of your codebase in our simple upload tab.</p>
            </div>
            
            <div className="flex-1 flex flex-col items-center text-center gap-4">
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'var(--weight-bold)', color: 'var(--cyan-light)', border: '1px solid var(--glass-border-light)' }}>
                2
              </div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>Deep Parsing</h3>
              <p className="text-muted text-sm">Our server parses syntax, builds SQLite relationship tables, and queries LLMs for multi-level summaries.</p>
            </div>

            <div className="flex-1 flex flex-col items-center text-center gap-4">
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'var(--weight-bold)', color: 'var(--violet-light)', border: '1px solid var(--glass-border-light)' }}>
                3
              </div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)' }}>Explore & Chat</h3>
              <p className="text-muted text-sm">Ask architectural questions, view dependency graphs, select files to view syntax and summaries, and download guides.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="section bg-base" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <div className="container">
          <div className="text-center" style={{ marginBottom: 'var(--sp-12)' }}>
            <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-bold)' }}>Flexible Plans for Every Team</h2>
            <p className="text-muted" style={{ marginTop: 'var(--sp-2)' }}>Choose the right model size and context length for your codebase.</p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--sp-6)',
            alignItems: 'stretch',
          }}>
            {/* Free */}
            <GlassCard variant="bordered" className="flex flex-col gap-6" style={{ height: '100%' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>Starter</h3>
                <p className="text-muted text-sm" style={{ marginTop: 4 }}>For small hobby projects</p>
              </div>
              <div>
                <span style={{ fontSize: '32px', fontWeight: 'var(--weight-bold)' }}>$0</span>
                <span className="text-muted"> / forever</span>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-secondary">
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> 3 Repositories</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Max 200 files per repo</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Standard AI Chat</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Dependency Graph view</li>
              </ul>
              <Link to="/connect" className="btn btn-secondary w-full" style={{ marginTop: 'auto' }}>Get Started</Link>
            </GlassCard>

            {/* Pro */}
            <GlassCard variant="glow" className="flex flex-col gap-6" style={{ height: '100%', borderColor: 'var(--primary)' }}>
              <div>
                <div className="badge badge-primary" style={{ float: 'right' }}>Most Popular</div>
                <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>Pro Developer</h3>
                <p className="text-muted text-sm" style={{ marginTop: 4 }}>For professional engineers</p>
              </div>
              <div>
                <span style={{ fontSize: '32px', fontWeight: 'var(--weight-bold)' }}>$19</span>
                <span className="text-muted"> / month</span>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-secondary">
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Unlimited Repositories</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Max 2,000 files per repo</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Premium AI Chat (LLaMA 3 70B)</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Multi-level summaries</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Auto-Docs generation</li>
              </ul>
              <Link to="/connect" className="btn btn-primary w-full" style={{ marginTop: 'auto' }}>Upgrade to Pro</Link>
            </GlassCard>

            {/* Team */}
            <GlassCard variant="bordered" className="flex flex-col gap-6" style={{ height: '100%' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>Team Space</h3>
                <p className="text-muted text-sm" style={{ marginTop: 4 }}>For collaborative teams</p>
              </div>
              <div>
                <span style={{ fontSize: '32px', fontWeight: 'var(--weight-bold)' }}>$49</span>
                <span className="text-muted"> / mo / seat</span>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-secondary">
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Collaborative workspace</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Private Git connectivity</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> High-frequency updates</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Team knowledge bases</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Premium Support</li>
              </ul>
              <Link to="/connect" className="btn btn-secondary w-full" style={{ marginTop: 'auto' }}>Create Team</Link>
            </GlassCard>

            {/* Enterprise */}
            <GlassCard variant="bordered" className="flex flex-col gap-6" style={{ height: '100%' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>Enterprise</h3>
                <p className="text-muted text-sm" style={{ marginTop: 4 }}>For secure, large scale operations</p>
              </div>
              <div>
                <span style={{ fontSize: '32px', fontWeight: 'var(--weight-bold)' }}>Custom</span>
                <span className="text-muted"> / custom terms</span>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-secondary">
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> On-prem / VPC deployments</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Custom parsing configurations</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Dedicated model fine-tuning</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> Single Sign-On (SAML SSO)</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-success" /> 24/7 SLA Support</li>
              </ul>
              <button className="btn btn-secondary w-full" style={{ marginTop: 'auto' }} onClick={() => alert('Contacting sales...!')}>Contact Sales</button>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--glass-border)', padding: 'var(--sp-12) 0', background: 'var(--bg-deepest)' }}>
        <div className="container flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="nav-logo-icon" style={{ width: 28, height: 28 }}><Code2 size={16} /></div>
            <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-lg)', background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              CodeVista
            </span>
          </div>
          
          <div className="flex gap-6 text-sm text-muted">
            <a href="#features" className="hover:text-primary">Features</a>
            <a href="#pricing" className="hover:text-primary">Pricing</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary">GitHub</a>
            <a href="#" className="hover:text-primary">Privacy</a>
          </div>

          <div className="text-xs text-dim">
            &copy; {new Date().getFullYear()} CodeVista. Powered by DeepMind & Antigravity.
          </div>
        </div>
      </footer>
    </div>
  );
}
