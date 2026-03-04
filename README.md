# Faster You – NeutralinoJS Edition

> A fast, secure, minimal task manager for web and desktop (macOS, Windows, Linux).

![Demo Screenshot](screenshot.png)

## Features

- **Two boards** — Today (focused work) and Backlog (everything else)
- **Task CRUD** — Add, edit, delete, and mark tasks done
- **Drag-and-drop** — Reorder tasks within a board or move between boards
- **Link tasks** — Connect tasks as related, blocks, or blocked by
- **Priority labels** — High (🔴), Medium (🟡), Low (🟢)
- **Search & Filter** — Find tasks by title; filter by All / Pending / Done
- **Import / Export** — JSON backup and restore via native file dialogs
- **Auto-cleanup** — Tasks older than N days are purged on launch (configurable)
- **Theme** — Light, Dark, or System
- **Local-first** — All data stored locally in SQLite (WebAssembly). No server required.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Tailwind CSS v4 |
| Desktop Shell | NeutralinoJS 5.4 |
| Database | SQLite via sql.js (WASM) |
| Drag & Drop | @dnd-kit |
| Data Fetching | TanStack Query |
| Build | Vite + NeutralinoJS CLI |


## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [NeutralinoJS CLI](https://neutralino.js.org/) (`npm i -g @neutralinojs/neu`)

### Install

```bash
npm install
npx neu update    # download Neutralino binaries & client
```

### Development

```bash
npm run dev
```

This starts Vite on port 3000 and launches the Neutralino window pointing at it. Hot-reload works for all React changes.

You can also develop as a plain web app:

```bash
npm run dev:web   # Vite dev server only (no native window)
```

### Production Build

```bash
npm run build         # TypeScript check + Vite build → dist/
npx neu build         # package into platform binaries → dist/fasteryou-*
```

Or in one step:

```bash
npm run neu:build
```

Output binaries are in `dist/`:


### Run the Built App

```bash
npx neu run
```

## Data Storage

The SQLite database is persisted via:

- **NeutralinoJS mode** — `Neutralino.filesystem` writes to `<user-data>/fasteryou/fasteryou.db`
- **Web/dev mode** — Falls back to `localStorage` (base64-encoded)

## License

MIT
