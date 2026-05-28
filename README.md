# CodeVista

A web service that reads an entire Git repository and turns it into a conversational, code-aware knowledge system for technical users.

## Features

- **Repository Connection** — Connect via GitHub URL or upload a source archive
- **Code-Aware Parsing** — AST-based parsing for Python and JavaScript
- **Dependency Mapping** — Interactive visualization of code relationships
- **Multi-Level Summaries** — Repository, module, and file-level understanding
- **Conversational Q&A** — Ask technical questions grounded in repository context
- **Documentation Generation** — Auto-generate README, onboarding guides, and architecture docs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, React Router, Framer Motion, React Flow |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| AI | Groq API (LLaMA 3.3 70B) |
| Parsing | @babel/parser (JS), Custom AST Parser (Python) |
| Git | simple-git |

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Git
- A [Groq API key](https://console.groq.com)

### Installation

```bash
# Clone the repository
git clone https://github.com/LeoPanthera07/CodeVista.git
cd CodeVista

# Install all dependencies
npm run install:all
```

### Configuration

Create a `.env` file in the `server/` directory:

```env
PORT=3001
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
NODE_ENV=development
```

### Running

```bash
# Start both client and server in development mode
npm run dev

# Or start them separately:
npm run dev:server   # Backend on http://localhost:3001
npm run dev:client   # Frontend on http://localhost:5173
```

### Building for Production

```bash
npm run build        # Builds the React frontend
npm start            # Starts the production server
```

## Project Structure

```
CodeVista/
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── context/     # React context providers
│   │   ├── services/    # API service layer
│   │   └── index.css    # Design system & styles
│   └── vite.config.js
├── server/              # Node.js backend (Express)
│   ├── src/
│   │   ├── routes/      # API route handlers
│   │   ├── services/    # Business logic
│   │   ├── parsers/     # Code parsing engines
│   │   ├── database/    # SQLite schema & queries
│   │   └── middleware/  # Express middleware
│   └── .env
└── package.json         # Root monorepo config
```

## API Documentation

### Repositories
- `POST /api/repositories/connect` — Clone a GitHub repository
- `POST /api/repositories/upload` — Upload a source archive
- `GET /api/repositories` — List all repositories
- `GET /api/repositories/:id` — Get repository details
- `GET /api/repositories/:id/status` — Get analysis status
- `DELETE /api/repositories/:id` — Delete a repository

### Analysis
- `GET /api/repositories/:id/summary` — Get multi-level summaries
- `GET /api/repositories/:id/map` — Get dependency/structure map
- `GET /api/repositories/:id/files` — Get file tree
- `GET /api/repositories/:id/files/:fileId` — Get file details

### Chat
- `POST /api/repositories/:id/chat` — Send a chat message
- `GET /api/repositories/:id/chat/history` — Get chat history

### Documentation
- `POST /api/repositories/:id/documentation` — Generate documentation
- `GET /api/repositories/:id/documentation` — Get generated docs

## License

MIT
