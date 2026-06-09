# CodeVista Client

The React 19 + Vite 8 frontend application for CodeVista. It provides a modern, fast, and visual web interface where users can upload or clone codebases, browse files, inspect AST dependency relationships, chat with their codebase, and generate architectural documents.

---

## Features & UI Views

- **Visual Dashboard** — A centralized hub showing cards for all analyzed repositories with metadata statistics (total files, detected symbols, parsing status, and analysis time).
- **Interactive Code Map** — Powered by **XYFlow React** (React Flow), this provides a node-based graph mapping class inheritance, module exports, function imports, and routing flows in the workspace.
- **Contextual File Explorer** — A custom collapsible file tree navigation system linked directly to the code viewer.
- **Premium Code Viewer** — Implements **Shiki** for beautiful syntax highlighting. Supports JavaScript, TypeScript, JSX, TSX, and Python.
- **Interactive AI Chat Panel** — A split-screen conversation dashboard supporting markdown answers, code snippets, auto-scrolling, and interactive file references (clicking a citation opens the referenced file directly at the line range).
- **Generative Manuals tab** — Generates and views structured markdown documents (READMEs, developer guides, system architectures, module details) in tabs.

---

## Design System & Styling

CodeVista Client uses a custom design system based entirely on **Vanilla CSS** (located in [client/src/index.css](file:///Users/mihir/Programming/Projects_Local/CodeVista/client/src/index.css)).

- **Typography** — Automatically imports and uses `@fontsource-variable/inter` for body text and `@fontsource-variable/jetbrains-mono` for code blocks.
- **Glassmorphism Panels** — Implements modern dark-mode aesthetics using HSL-based colors, subtle semi-transparent background blurs (`backdrop-filter`), thin borders, and radial gradients.
- **Micro-Animations** — Framer Motion controls transitions between pages and modals, providing smooth, hardware-accelerated transitions.

---

## Page Layouts

The application implements routing via **React Router 7** across 6 core views:

1. **Landing Page** (`LandingPage.jsx`) — Features a premium landing layout introducing the application's benefits and features.
2. **Authentication Pages** (`LoginPage.jsx` & `SignupPage.jsx`) — Sleek, modern form cards handling input verification, token assignment, and error alerts.
3. **Dashboard Page** (`DashboardPage.jsx`) — Grid workspace listing all connected repositories, highlighting status alerts (e.g. pending, cloning, ready, error).
4. **Connect Repository Page** (`ConnectRepoPage.jsx`) — Provides input forms for repository HTTPS URLs, as well as a drag-and-drop uploader for ZIP archives.
5. **Repository Analysis Workspace** (`RepoAnalysisPage.jsx`) — The main workspace containing the File Tree, Code Viewer, Dependency Graph, AI Chat, and Documentation tabs.

---

## State Management & Context

Global application state is managed by a single Context Provider in [AppContext.jsx](file:///Users/mihir/Programming/Projects_Local/CodeVista/client/src/context/AppContext.jsx):

- **Auth State** — Stores the logged-in user profile, authorization token (persisted in `localStorage`), and optional custom Groq API keys.
- **Repository State** — Handles repository loading states, active repository details, status checks, and additions/deletions.
- **Chat State** — Manages active conversation logs, scrolling queues, references, and loading states.
- **Toast Notifications** — A custom toast dispatch queue managing transient feedback messages across views.

---

## Key Components Structure

- [Navbar.jsx](file:///Users/mihir/Programming/Projects_Local/CodeVista/client/src/components/Navbar.jsx) — Application header with status indicators, responsive mobile slide-out menu, profile options, and custom API key update modals.
- [DependencyGraph.jsx](file:///Users/mihir/Programming/Projects_Local/CodeVista/client/src/components/DependencyGraph.jsx) — The XYFlow canvas mapping out symbol nodes and connectors.
- [FileTree.jsx](file:///Users/mihir/Programming/Projects_Local/CodeVista/client/src/components/FileTree.jsx) — Nested folders visualizer supporting expansion/collapse states.
- [CodeBlock.jsx](file:///Users/mihir/Programming/Projects_Local/CodeVista/client/src/components/CodeBlock.jsx) — Houses the Shiki-based code preview container.
- [Toast.jsx](file:///Users/mihir/Programming/Projects_Local/CodeVista/client/src/components/Toast.jsx) — System notices container with automatic expiration.

---

## Scripts & Deployment

From the `client/` subdirectory:

```bash
# Start Vite development server locally (default http://localhost:5173)
npm run dev

# Compile assets and optimize bundles for production (output to client/dist)
npm run build

# Run ESLint validation checks across source files
npm run lint

# Preview the built production assets locally
npm run preview
```
