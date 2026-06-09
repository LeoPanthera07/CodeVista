# CodeVista Server

The Node.js backend application for CodeVista. It is structured as a decentralized, multi-process microservice architecture orchestrated and routed from a single API Gateway entry point. It manages SQLite database records, runs AST code parsers, maps symbol dependencies, and orchestrates LLM tasks via Groq.

---

## Architecture Overview

```
                      ┌────────────────────────┐
                      │       HTTP Client      │ (Port 5173 / Browser)
                      └───────────┬────────────┘
                                  │
                                  ▼ [Port 3001]
                      ┌────────────────────────┐
                      │    API Gateway app     │ (index.js Orchestrator)
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

The gateway entry point starts a process orchestrator which forks four specialized microservice child processes:

1. **Auth Service** (Port `3002`) — Entry point: `src/microservices/auth-service.js`. Runs the user registration, login validation, JWT signature, and personal API key handlers.
2. **Repository Service** (Port `3003`) — Entry point: `src/microservices/repository-service.js`. Performs Git cloning, ZIP extraction, file index scanning, AST symbol parsing, and database storage.
3. **Chat Service** (Port `3004`) — Entry point: `src/microservices/chat-service.js`. Handles the Q&A thread, citation formatting, and event stream piping (SSE).
4. **Documentation Service** (Port `3005`) — Entry point: `src/microservices/documentation-service.js`. Manages automated generation of technical documentation.

---

## Configuration Variables

Copy [server/.env.example](file:///Users/mihir/Programming/Projects_Local/CodeVista/server/.env.example) to `.env` in the server root.

| Environment Variable | Description | Default Value |
| :--- | :--- | :--- |
| `PORT` | Port the Express API Gateway listens on. | `3001` |
| `PORT_AUTH` | Port allocated to the Auth Microservice. | `3002` |
| `PORT_REPO` | Port allocated to the Repository Microservice. | `3003` |
| `PORT_CHAT` | Port allocated to the Chat Microservice. | `3004` |
| `PORT_DOC` | Port allocated to the Documentation Microservice. | `3005` |
| `NODE_ENV` | Application environment (`development` or `production`).| `development` |
| `GROQ_API_KEY` | Secret token to authenticate with Groq Cloud. | *(Required)* |
| `LLM_MODEL` | The default text model requested from the API. | `llama-3.3-70b-versatile`|
| `LLM_MAX_TOKENS` | Max tokens generated in completion answers. | `4096` |
| `LLM_TEMPERATURE` | Creativity temperature for code summaries & Q&A. | `0.3` |
| `REPOS_DIR` | Folder name where repositories are cloned/extracted. | `repos` |
| `UPLOADS_DIR` | Temp directory for uploaded ZIP archives. | `uploads` |
| `DATA_DIR` | Directory housing the SQLite database. | `data` |
| `CORS_ORIGIN` | Allowed Client CORS domains. | `http://localhost:5173` |
| `LLM_RATE_LIMIT_RPM` | Maximum LLM queries allowed per minute. | `30` |
| `LOG_LEVEL` | Morgan HTTP logging profile. | `dev` |

---

## API Gateway & Orchestration Mechanics

### 1. Eager Database Initialization
Before spawning child services, the API Gateway (`src/index.js`) initializes the SQLite schema using `getDb()`. This ensures that when the microservices start, they do not face race conditions trying to read or write to uninitialized tables.

### 2. Process Spawning
The Gateway uses Node's `child_process.fork()` to spin up the four service entrypoints. To prevent recursive fork spawning, the process environment injects an `IS_CHILD_SERVICE=true` flag into the child environments:

```javascript
const child = fork(service.path, [], {
  env: {
    ...process.env,
    IS_CHILD_SERVICE: 'true',
  },
});
```

### 3. Stream Proxying
The Gateway forwards HTTP requests to their destination services using Node's native `http.request`. The client request body stream is piped directly to the downstream target:

```javascript
req.pipe(proxyReq, { end: true });
```

Because the Gateway does not parse request bodies globally on proxied routes, the raw request stream (including large JSON objects, binary multipart files from ZIP uploads, and SSE streams) is forwarded transparently. The downstream microservices then parse their respective requests using local middleware.

---

## SQLite Database Schema

All microservices share access to the same SQLite database file. In order to handle concurrent access, WAL (Write-Ahead Logging) is enabled in `database/db.js`:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

This allows multiple processes to perform concurrent read operations while a single process writes to the database.

---

## Running the Backend

Start development mode with hot-reloading (automatically watches and restarts the Gateway and spawns microservices):
```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Run in production
npm start
```
