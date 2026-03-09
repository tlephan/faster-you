/**
 * Local API server for web mode.
 * Stores the SQLite database on disk so all browsers share the same data.
 * Runs on http://127.0.0.1:8191
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, appendFileSync, readdirSync, unlinkSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

const PORT = parseInt(process.env.PORT || '8191', 10);
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, 'dist');
const SERVE_STATIC = existsSync(distDir);

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

// ── Logging ───────────────────────────────────────────────────
const logDir = join(homedir(), '.fasteryou', 'logs');
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
const LOG_RETENTION_DAYS = 7;

function getLogFile() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return join(logDir, `server-${date}.log`);
}

function rotateOldLogs() {
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of readdirSync(logDir)) {
    const match = file.match(/^server-(\d{4}-\d{2}-\d{2})\.log$/);
    if (match && new Date(match[1]).getTime() < cutoff) {
      unlinkSync(join(logDir, file));
    }
  }
}

rotateOldLogs();

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  appendFileSync(getLogFile(), line + '\n');
}

function logError(...args) {
  const line = `[${new Date().toISOString()}] ERROR ${args.join(' ')}`;
  console.error(line);
  appendFileSync(getLogFile(), line + '\n');
}

// ── Database setup ────────────────────────────────────────────
const dbDir = join(homedir(), '.fasteryou');
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
const dbPath = join(dbDir, 'fasteryou.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    done        INTEGER NOT NULL DEFAULT 0,
    board       TEXT NOT NULL DEFAULT 'today' CHECK (board IN ('today', 'backlog')),
    priority    TEXT NOT NULL DEFAULT 'medium'  CHECK (priority IN ('high', 'medium', 'low')),
    position    REAL NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task_links (
    id             TEXT PRIMARY KEY,
    source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type           TEXT NOT NULL CHECK (type IN ('related', 'blocks', 'blocked_by')),
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_task_id, target_task_id, type)
  );
`);

// Migration: add due_date column
try {
  db.prepare('SELECT due_date FROM tasks LIMIT 1').get();
} catch {
  db.exec('ALTER TABLE tasks ADD COLUMN due_date TEXT DEFAULT NULL');
}

// ── Helpers ───────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ── Request handler ───────────────────────────────────────────
const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const method = req.method;
  const query = url.search || '';
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const line = `${method} ${path}${query} → ${res.statusCode} (${ms}ms)`;
    res.statusCode >= 400 ? logError(line) : log(line);
  });

  try {
    // Health check
    if (method === 'GET' && path === '/ping') {
      return json(res, 200, { ok: true });
    }

    // ── Tasks ──────────────────────────────────────────────────
    if (method === 'GET' && path === '/tasks') {
      const board = url.searchParams.get('board');
      const tasks = board
        ? db.prepare('SELECT * FROM tasks WHERE board = ? ORDER BY done ASC, position ASC').all(board)
        : db.prepare('SELECT * FROM tasks ORDER BY board, done ASC, position ASC').all();
      return json(res, 200, { tasks });
    }

    if (method === 'GET' && path === '/tasks/search') {
      const q = url.searchParams.get('q') || '';
      const pattern = `%${q}%`;
      const tasks = db
        .prepare('SELECT * FROM tasks WHERE title LIKE ? OR description LIKE ? ORDER BY board, position ASC')
        .all(pattern, pattern);
      return json(res, 200, { tasks });
    }

    if (method === 'DELETE' && path === '/tasks/older-than') {
      const { days } = await readBody(req);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { changes } = db.prepare('DELETE FROM tasks WHERE done = 1 AND created_at < ?').run(cutoff);
      return json(res, 200, { deleted: changes });
    }

    if (method === 'POST' && path === '/tasks') {
      const body = await readBody(req);
      const id = randomUUID();
      const { m } = db.prepare('SELECT MAX(position) as m FROM tasks WHERE board = ?').get(body.board) ?? {};
      const position = (m ?? 0) + 1;
      db.prepare(
        'INSERT INTO tasks (id, title, description, board, priority, position, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, body.title, body.description ?? null, body.board, body.priority ?? 'medium', position, body.due_date ?? null);
      return json(res, 201, db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
    }

    const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const id = taskMatch[1];

      if (method === 'GET') {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        return task ? json(res, 200, task) : json(res, 404, { error: 'Not found' });
      }

      if (method === 'PATCH') {
        const body = await readBody(req);
        const cols = ['title', 'description', 'priority', 'board', 'position', 'due_date'];
        const fields = [], values = [];
        for (const k of cols) if (k in body) { fields.push(`${k} = ?`); values.push(body[k]); }
        if (!fields.length) return json(res, 400, { error: 'Nothing to update' });
        fields.push(`updated_at = datetime('now')`);
        db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
        return json(res, 200, db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
      }

      if (method === 'DELETE') {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        return json(res, 200, { success: true });
      }
    }

    const actionMatch = path.match(/^\/tasks\/([^/]+)\/(toggle|move|reorder)$/);
    if (actionMatch) {
      const [, id, action] = actionMatch;
      const body = action === 'toggle' ? {} : await readBody(req);

      if (action === 'toggle') {
        db.prepare(`UPDATE tasks SET done = NOT done, updated_at = datetime('now') WHERE id = ?`).run(id);
      } else if (action === 'move') {
        const { m } = db.prepare('SELECT MAX(position) as m FROM tasks WHERE board = ?').get(body.board) ?? {};
        db.prepare(`UPDATE tasks SET board = ?, position = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(body.board, (m ?? 0) + 1, id);
      } else if (action === 'reorder') {
        db.prepare(`UPDATE tasks SET position = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(body.position, id);
      }
      return json(res, 200, db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
    }

    // ── Task Links ─────────────────────────────────────────────
    if (method === 'GET' && path === '/task-links') {
      const links = db.prepare(`
        SELECT tl.*, st.title AS source_title, tt.title AS target_title
        FROM task_links tl
        JOIN tasks st ON st.id = tl.source_task_id
        JOIN tasks tt ON tt.id = tl.target_task_id
      `).all();
      return json(res, 200, { links });
    }

    if (method === 'POST' && path === '/task-links') {
      const body = await readBody(req);
      const id = randomUUID();
      db.prepare(
        'INSERT INTO task_links (id, source_task_id, target_task_id, type) VALUES (?, ?, ?, ?)'
      ).run(id, body.sourceTaskId, body.targetTaskId, body.type);
      return json(res, 201, db.prepare('SELECT * FROM task_links WHERE id = ?').get(id));
    }

    const linkMatch = path.match(/^\/task-links\/([^/]+)$/);
    if (linkMatch) {
      const id = linkMatch[1];

      if (method === 'GET') {
        const links = db.prepare(`
          SELECT tl.*, st.title AS source_title, tt.title AS target_title
          FROM task_links tl
          JOIN tasks st ON st.id = tl.source_task_id
          JOIN tasks tt ON tt.id = tl.target_task_id
          WHERE tl.source_task_id = ? OR tl.target_task_id = ?
        `).all(id, id);
        return json(res, 200, { links });
      }

      if (method === 'DELETE') {
        db.prepare('DELETE FROM task_links WHERE id = ?').run(id);
        return json(res, 200, { success: true });
      }
    }

    // ── Export / Import ────────────────────────────────────────
    if (method === 'GET' && path === '/export') {
      const tasks = db.prepare('SELECT * FROM tasks').all();
      const taskLinks = db.prepare('SELECT * FROM task_links').all();
      return json(res, 200, { version: 1, exportedAt: new Date().toISOString(), tasks, taskLinks });
    }

    if (method === 'POST' && path === '/import') {
      const data = await readBody(req);
      db.transaction(() => {
        db.prepare('DELETE FROM task_links').run();
        db.prepare('DELETE FROM tasks').run();
        for (const t of data.tasks) {
          db.prepare(
            `INSERT INTO tasks (id, title, description, done, board, priority, position, due_date, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(t.id, t.title, t.description ?? null, t.done ?? 0, t.board, t.priority, t.position ?? 0, t.due_date ?? null, t.created_at, t.updated_at);
        }
        for (const l of data.taskLinks) {
          db.prepare(
            'INSERT INTO task_links (id, source_task_id, target_task_id, type, created_at) VALUES (?, ?, ?, ?, ?)'
          ).run(l.id, l.source_task_id, l.target_task_id, l.type, l.created_at);
        }
      })();
      return json(res, 200, { success: true, taskCount: data.tasks.length });
    }

    // ── Static file serving ────────────────────────────────────
    if (SERVE_STATIC && method === 'GET') {
      let filePath = resolve(distDir, path === '/' ? 'index.html' : path.slice(1));
      if (!filePath.startsWith(distDir + '/') && filePath !== distDir) {
        return json(res, 403, { error: 'Forbidden' });
      }
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        filePath = join(distDir, 'index.html'); // SPA fallback
      }
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mime, ...CORS });
      return res.end(content);
    }

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    logError(`${method} ${path} —`, err);
    json(res, 500, { error: String(err) });
  }
});

const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  log(`[Server] http://127.0.0.1:${PORT}`);
  log(`[Server] Database: ${dbPath}`);
  log(`[Server] Log dir: ${logDir}`);
});
