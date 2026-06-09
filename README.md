# CodeVista

A powerful, code-aware knowledge service that reads an entire Git repository or source archive and transforms it into an interactive, conversational developer environment. CodeVista parses syntax trees, extracts symbols, maps file/symbol interrelationships, and delivers contextualized AI explanations and documentation.

> [!IMPORTANT]
> **Security Compliance Guardrails:** 
> CodeVista enforces strict security auditing constraints. Under standard compliance, full security analysis, vulnerability scanning, and threat-vector profiling are restricted to verified repository owners. Unverified users can still browse architecture, explore dependencies, and perform general Q&A, but security-focused queries will prompt for ownership verification (via personal access token or username validation).

---

## Table of Contents
1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Configuration](#environment-configuration)
   - [Running the Application](#running-the-application)
   - [Production Build](#production-build)
5. [Project Directory Structure](#project-directory-structure)
6. [API Endpoints Reference](#api-endpoints-reference)
7. [License](#license)

---

## Features

- **Double-Channel Repository Connection** — Connect remote Git repositories over HTTPS (with shallow single-branch cloning) or upload `.zip` source archives.
- **AST-Based Symbol Parsing** — Deep, language-specific syntax analysis for JavaScript, TypeScript, JSX, TSX, MJS, CJS, Python (`.py`), and Python GUI scripts (`.pyw`). Extracts functions, classes, methods, variables, routes, and imports/exports.
- **Dependency & Symbol Relationship Mapping** — Automatically maps code references (`import`, `extends`, `implements`, `calls`, `uses`) into an interactive visual graph.
- **Hierarchical Summarization** — Automated LLM summary generation at the file, module (directory), and repository levels.
- **Grounded Conversational Q&A** — Context-aware chat with code citations (filenames, function names, and line ranges) that updates chat history dynamically.
- **Automated Doc Generator** — Instantly generate structured, professional technical manuals including READMEs, developer onboarding guides, detailed architectural blueprints, and module-specific references.

---

## Tech Stack

| Layer | Component | Technologies Used |
| :--- | :--- | :--- |
| **Frontend** | Framework & Bundling | React 19 + Vite 8, React Router 7 |
| | Visual Mapping | **XYFlow React** (React Flow v12) |
| | Animation & Design | Framer Motion, Vanilla CSS (Glassmorphism design system) |
| | Utilities | Lucide React, Shiki (Syntax Highlighter), React Markdown + Remark GFM |
| **Backend** | Server Runtime | Node.js + Express 5 |
| | Repository Cloner | `simple-git` (shallow branch cloning) |
| | File Extraction | `adm-zip` |
| **Database** | Persistence Layer | SQLite via `better-sqlite3` (WAL mode & foreign key cascades enabled) |
| **Parsing** | AST Engines | `@babel/parser` (JS/JSX/TS/TSX/MJS/CJS) & Custom Python AST Parser |
| **AI Layer** | LLM Engine | Groq SDK (Primary: `llama-3.3-70b-versatile` with automatic failover chain to `llama-3.1-8b-instant` and `meta-llama/llama-4-scout-17b-16e-instruct` on rate limits or API errors) |

---

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **Git** installed on the host system
- A [Groq API key](https://console.groq.com)

### Installation

Clone the repository and install dependencies in the root, server, and client directories:

```bash
# Clone the repository
git clone https://github.com/LeoPanthera07/CodeVista.git
cd CodeVista

# Run the monorepo installation script (installs all workspaces)
npm run install:all
```

### Environment Configuration

Create a `.env` file in the `server/` directory:

```env
# Server
PORT=3001
NODE_ENV=development

# Groq API Configuration
GROQ_API_KEY=your_groq_api_key_here

# LLM Configuration
LLM_MODEL=llama-3.3-70b-versatile
LLM_MAX_TOKENS=4096
LLM_TEMPERATURE=0.3

# Storage Paths
REPOS_DIR=repos
UPLOADS_DIR=uploads
DATA_DIR=data

# CORS Allowed Origin
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
LLM_RATE_LIMIT_RPM=30

# Logging
LOG_LEVEL=dev
```

### Running the Application

Start both client and server concurrently in development mode:

```bash
# Run client and server together
npm run dev

# Or run components individually:
npm run dev:server   # Starts Express backend (http://localhost:3001)
npm run dev:client   # Starts Vite client (http://localhost:5173)
```

### Production Build

Build the production bundle for the frontend and run the production server:

```bash
# Build React application to client/dist
npm run build

# Start production server (serves the backend and statically hosts client assets)
npm start
```

---

## Project Directory Structure

```
CodeVista/
├── client/                  # React Client (Vite)
│   ├── src/
│   │   ├── assets/          # Static icons and visuals
│   │   ├── components/      # UI components (Flow graphs, trees, cards)
│   │   ├── context/         # AppState Provider (Auth, Repos, Chat)
│   │   ├── pages/           # Routed page layouts (Dashboard, Workspace)
│   │   ├── services/        # Client API client methods
│   │   ├── index.css        # Core glassmorphic styling system (80KB+)
│   │   └── main.jsx         # App entry point
│   ├── vite.config.js       # Vite configuration
│   └── package.json         # Client dependencies & scripts
│
├── server/                  # Node.js Server (Express)
│   ├── src/
│   │   ├── database/        # SQLite database connection & schema definitions
│   │   ├── middleware/      # Authentication, Ownership guards, Validator filters
│   │   ├── parsers/         # Babel (JS/TS) & custom Python AST parsers
│   │   ├── routes/          # Express route controllers (Auth, Repos, Chat)
│   │   ├── services/        # Service layer (Analysis, Git clone, LLM, Chat)
│   │   ├── utils/           # Crypto helpers & parser utilities
│   │   └── index.js         # Backend entry point (starts server)
│   ├── .env.example         # Template for environment configuration
│   └── package.json         # Server dependencies & engine requirements
│
├── package.json             # Root monorepo workspace configurations
└── README.md                # General introduction & setup guide
```

---

## API Endpoints Reference

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/signup` | Create user profile, store hashed credentials, return JWT. | Public |
| **POST** | `/login` | Authenticate user credentials, return user stats & JWT. | Public |
| **GET** | `/me` | Get current user's profile information. | Private |
| **PUT** | `/key` | Set/Update a user-specific custom Groq API key. | Private |

### Repositories (`/api/repositories`)

All repository endpoints (except creation and listing) require authentication and verify ownership checks.

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/connect` | Clone a Git repository from a public HTTPS URL. | Private |
| **POST** | `/upload` | Upload a ZIP archive containing source files (max 100MB). | Private |
| **GET** | `/` | List all repositories connected/uploaded by the current user. | Private |
| **GET** | `/:id` | Get metadata details for a specific repository. | Private |
| **GET** | `/:id/status` | Get analysis progress, counts of files, and symbols. | Private |
| **POST** | `/:id/verify` | Verify repository ownership via GitHub username or Token. | Private |
| **DELETE**| `/:id` | Remove repository details, summaries, and disk contents. | Private |

### Code Analysis (`/api/repositories/:id`)

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **GET** | `/summary` | Retrieve repository-level, module-level, and file-level summaries. | Private |
| **GET** | `/map` | Retrieve symbol dependencies and file import connections. | Private |
| **GET** | `/files` | Get nested directory file tree structure. | Private |
| **GET** | `/files/:fileId` | Fetch file contents and extracted AST symbols. | Private |

### Conversational Q&A (`/api/repositories/:id/chat`)

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/` | Send a chat message query, returns AI response with file citations. | Private |
| **GET** | `/history` | Fetch chat message history logs. | Private |
| **DELETE**| `/history` | Clear all chat history logs for this repository. | Private |

### Documentation Generative (`/api/repositories/:id/documentation`)

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/` | Generate structured markdown (readme / onboarding / architecture / module).| Private |
| **GET** | `/` | List all generated documentation entries for the repository. | Private |
| **GET** | `/:docId` | Retrieve the specific generated markdown document content. | Private |

---

## License

This project is licensed under the MIT License - see the [LICENSE](file:///Users/mihir/Programming/Projects_Local/CodeVista/LICENSE) file for details.
