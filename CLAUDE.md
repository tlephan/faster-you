# CLAUDE.md - FasterYou

## Project Overview

FasterYou is a local-first Kanban task management app with two boards (Today & Backlog). It runs as a web app with a Node.js API server + Vite frontend.

## Tech Stack

- **Frontend:** React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7
- **State:** TanStack React Query 5
- **Drag & Drop:** @dnd-kit
- **Database:** SQLite via sql.js (browser) / better-sqlite3 (server)
- **Icons:** lucide-react
- **Styling utilities:** class-variance-authority, clsx, tailwind-merge

## Project Structure

```
src/
  main.tsx          # Entry point - initializes DB, detects server, renders app
  App.tsx           # Main component - two-board kanban layout
  api.ts            # API client (HTTP server mode or direct DB mode)
  db.ts             # SQLite database layer (sql.js in-browser)
  types.ts          # TypeScript interfaces (Task, TaskLink, etc.)
  hooks.ts          # React Query hooks for API operations
  index.css         # Tailwind CSS + HSL CSS variable theme
  lib/utils.ts      # cn() classname utility
  components/       # React components (BoardColumn, TaskCard, TaskDialog, etc.)
server/
  index.js          # Node.js HTTP API server using better-sqlite3
scripts/            # Shell/batch helper scripts for start/shutdown
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite (port 8190) + API server (port 8191) |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Preview production build |
| `npm run typecheck` | TypeScript type checking only |

## Database

SQLite with two tables:

- **tasks** - id (UUID), title, description, done, board (`today`/`backlog`), priority (`high`/`medium`/`low`), position, timestamps
- **task_links** - id (UUID), source_task_id, target_task_id, type (`related`/`blocks`/`blocked_by`), created_at

Storage locations:
- Web server mode: `~/.fasteryou/fasteryou.db`
- Browser-only mode: IndexedDB

## API

Server runs on port 8191 (configurable via `PORT` env var). Key endpoints:

- `GET/POST /tasks` - List/create tasks
- `GET/PATCH/DELETE /tasks/:id` - Single task CRUD
- `POST /tasks/:id/toggle` - Toggle done
- `POST /tasks/:id/move` - Move between boards
- `POST /tasks/:id/reorder` - Update position
- `GET/POST/DELETE /task-links` - Task link operations
- `GET /export`, `POST /import` - Backup/restore

## Code Conventions

- **Components:** Functional React components with hooks, props drilling
- **Styling:** Tailwind utility classes, `cn()` for conditional classnames, CSS variable theming (HSL), dark mode via `dark` class
- **State:** React Query for server state, localStorage for preferences (theme, fontSize, expirationDays)
- **Database:** Parameterized queries, validation helpers (assertUuid, assertBoard, etc.), 300ms debounced saves
- **Validation:** UUID format, board/priority/link-type enums, text length limits (title: 255, description: 5000, search: 100)

## TypeScript

- Strict mode enabled with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Path alias: `@/*` maps to `src/*`
- Target: ES2020, Module: ESNext

## No Tests

No testing framework is currently configured.
