# CodeVista

A powerful, code-aware knowledge service that reads an entire Git repository or source archive and transforms it into an interactive, conversational developer environment. CodeVista parses syntax trees, extracts symbols, maps file/symbol interrelationships, and delivers contextualized AI explanations and documentation.

> [!IMPORTANT]
> **Security Compliance Guardrails:** 
> CodeVista enforces strict security auditing constraints. Under standard compliance, full security analysis, vulnerability scanning, and threat-vector profiling are restricted to verified repository owners. Unverified users can still browse architecture, explore dependencies, and perform general Q&A, but security-focused queries will prompt for ownership verification (via personal access token or username validation).

---

## Table of Contents
1. [Features](#features)
2. [Tech Stack & Architecture](#tech-stack--architecture)
3. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Configuration](#environment-configuration)
   - [Running the Application](#running-the-application)
   - [Production Build](#production-build)
4. [Project Directory Structure](#project-directory-structure)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [License](#license)

---

## Features

- **Double-Channel Repository Connection** — Connect remote Git repositories over HTTPS (with shallow single-branch cloning) or upload `.zip` source archives.
- **AST-Based Symbol Parsing** — Deep, language-specific syntax analysis for JavaScript, TypeScript, JSX, TSX, MJS, CJS, Python (`.py`), and Python GUI scripts (`.pyw`). Extracts functions, classes, methods, variables, routes, and imports/exports.
- **Dependency & Symbol Relationship Mapping** — Automatically maps code references (`import`, `extends`, `implements`, `calls`, `uses`) into an interactive visual graph.
- **Hierarchical Summarization** — Automated LLM summary generation at the file, module (directory), and repository levels.
- **Grounded Conversational Q&A** — Context-aware chat with code citations (filenames, function names, and line ranges) that updates chat history dynamically.
- **Automated Doc Generator** — Instantly generate structured, professional technical manuals including READMEs, developer onboarding guides, detailed architectural blueprints, and module-specific references.

---

## Tech Stack & Architecture

CodeVista uses an **API Gateway & Microservices** backend architecture running concurrently with the React frontend.

```
                      ┌────────────────────────┐
                      │      Vite Client       │
                      └───────────┬────────────┘
                                  │
                                  ▼ [Port 3001]
                      ┌────────────────────────┐
                      │      API Gateway       │ (Orchestrator)
                      └─────┬───┬────┬───┬─────┘
                            │   │    │   │
          ┌─────────────────┘   │    │   └─────────────────┐
          ▼ [Port 3002]         │    │                     ▼ [Port 3005]
   ┌──────────────┐             │    └──────────────┐    ┌────────────────┐
   │ Auth Service │             │                   │    │ Doc Service    │
   └──────────────┘             ▼ [Port 3003]       ▼    └────────────────┘
                       ┌──────────────┐    ┌──────────────┐ [Port 3004]
                       │ Repo Service │    │ Chat Service │
                       └──────────────┘    └──────────────┘
```

| Layer | Component | Technologies Used |
| :--- | :--- | :--- |
| **Frontend** | Framework & Bundling | React 19 + Vite 8, React Router 7 |
| | Visual Mapping | **XYFlow React** (React Flow v12) |
| | Animation & Design | Framer Motion, Vanilla CSS (Glassmorphism design system) |
| | Utilities | Lucide React, Shiki (Syntax Highlighter), React Markdown + Remark GFM |
| **Backend** | API Gateway & Router | Express 5 acting as transparent stream proxy on port `3001` |
| | Microservices | Spawns 4 dedicated child processes: **Auth** (3002), **Repo** (3003), **Chat** (3004), **Doc** (3005) |
| | Cloner & Extractor | `simple-git` (shallow branch cloning) & `adm-zip` |
| **Database** | Persistence Layer | SQLite via `better-sqlite3` (WAL mode & foreign key cascades enabled) |
| **Parsing** | AST Engines | `@babel/parser` (JS/JSX/TS/TSX/MJS/CJS) & Custom Python AST Parser |
| **AI Layer** | LLM Engine | Groq SDK (Primary: `llama-3.3-70b-versatile` with failover chain to `llama-3.1-8b-instant` and `meta-llama/llama-4-scout-17b-16e-instruct`) |

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
# Server API Gateway Port
PORT=3001
NODE_ENV=development

# Microservice Port Mappings (Optional Custom Configuration)
PORT_AUTH=3002
PORT_REPO=3003
PORT_CHAT=3004
PORT_DOC=3005

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

To run the application, you only need to run a single command in the workspace root. Starting the server launches the **API Gateway orchestrator**, which automatically spawns and manages all 4 microservices in separate processes:

```bash
# Run client and server (Gateway + Microservices) together
npm run dev

# Or run components individually:
npm run dev:server   # Starts Gateway + Microservices (runs index.js)
npm run dev:client   # Starts Vite client (http://localhost:5173)
```

### Production Build

Build the production bundle for the frontend and run the production server:

```bash
# Build React application to client/dist
npm run build

# Start production server (serves the Gateway and statically hosts client assets)
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
│   │   ├── microservices/   # Independent service entrypoints (Port 3002-3005) [NEW]
│   │   │   ├── auth-service.js
│   │   │   ├── repository-service.js
│   │   │   ├── chat-service.js
│   │   │   └── documentation-service.js
│   │   ├── middleware/      # Authentication, Ownership guards, Validator filters
│   │   ├── parsers/         # Babel (JS/TS) & custom Python AST parsers
│   │   ├── routes/          # Express route controllers (Auth, Repos, Chat)
│   │   ├── services/        # Service layer (Analysis, Git clone, LLM, Chat)
│   │   ├── utils/           # Crypto helpers & parser utilities
│   │   └── index.js         # API Gateway & Process Orchestrator entry point
│   ├── .env.example         # Template for environment configuration
│   └── package.json         # Server dependencies & engine requirements
│
├── package.json             # Root monorepo workspace configurations
└── README.md                # General introduction & setup guide
```

---

## API Endpoints Reference

All requests must be sent to the API Gateway at port `3001` (`/api`). The Gateway routes each request to its target microservice.

### Authentication (Routed to `PORT_AUTH` - 3002)

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/signup` | Create user profile, store hashed credentials, return JWT. | Public |
| **POST** | `/api/auth/login` | Authenticate user credentials, return user stats & JWT. | Public |
| **GET** | `/api/auth/me` | Get current user's profile information. | Private |
| **PUT** | `/api/auth/key` | Set/Update a user-specific custom Groq API key. | Private |

### Repositories & Analysis (Routed to `PORT_REPO` - 3003)

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/repositories/connect` | Clone a Git repository from a public HTTPS URL. | Private |
| **POST** | `/api/repositories/upload` | Upload a ZIP archive containing source files (max 100MB). | Private |
| **GET** | `/api/repositories` | List all repositories connected/uploaded by the current user. | Private |
| **GET** | `/api/repositories/:id` | Get metadata details for a specific repository. | Private |
| **GET** | `/api/repositories/:id/status` | Get analysis progress, counts of files, and symbols. | Private |
| **POST** | `/api/repositories/:id/verify` | Verify repository ownership via GitHub username or Token. | Private |
| **DELETE**| `/api/repositories/:id` | Remove repository details, summaries, and disk contents. | Private |
| **GET** | `/api/repositories/:id/summary` | Retrieve repository-level, module-level, and file-level summaries. | Private |
| **GET** | `/api/repositories/:id/map` | Retrieve symbol dependencies and file import connections. | Private |
| **GET** | `/api/repositories/:id/files` | Get nested directory file tree structure. | Private |
| **GET** | `/api/repositories/:id/files/:fileId` | Fetch file contents and extracted AST symbols. | Private |

### Conversational Q&A (Routed to `PORT_CHAT` - 3004)

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/repositories/:id/chat` | Send a chat message query, returns AI response with file citations. | Private |
| **GET** | `/api/repositories/:id/chat/history` | Fetch chat message history logs. | Private |
| **DELETE**| `/api/repositories/:id/chat/history` | Clear all chat history logs for this repository. | Private |

### Documentation Generative (Routed to `PORT_DOC` - 3005)

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/repositories/:id/documentation` | Generate structured markdown (readme / onboarding / architecture / module).| Private |
| **GET** | `/api/repositories/:id/documentation` | List all generated documentation entries for the repository. | Private |
| **GET** | `/api/repositories/:id/documentation/:docId` | Retrieve the specific generated markdown document content. | Private |

---

## License

This project is licensed under the MIT License - see the [LICENSE](file:///Users/mihir/Programming/Projects_Local/CodeVista/LICENSE) file for details.
