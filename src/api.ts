import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute, getChanges, transaction, forceSave } from './db';

// ── Server mode (web only) ────────────────────────────────────
const DEV_SERVER_URL = 'http://127.0.0.1:8191';
const SERVER_URL = import.meta.env.DEV ? DEV_SERVER_URL : '';
let serverMode = false;

export async function detectServer(): Promise<boolean> {
  try {
    const pingUrl = import.meta.env.DEV ? `${DEV_SERVER_URL}/ping` : '/ping';
    const res = await fetch(pingUrl, { signal: AbortSignal.timeout(600) });
    serverMode = res.ok;
  } catch {
    serverMode = false;
  }
  return serverMode;
}

async function sf(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

import type {
  Task,
  TaskLink,
  CreateTaskInput,
  UpdateTaskInput,
  CreateTaskLinkInput,
  AppInfo,
} from './types';

// Validation helpers
const VALID_BOARDS = ['today', 'backlog'] as const;
const VALID_PRIORITIES = ['high', 'medium', 'low'] as const;
const VALID_LINK_TYPES = ['related', 'blocks', 'blocked_by'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SEARCH_LENGTH = 100;

function assertUuid(value: unknown, name = 'id'): asserts value is string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error(`Invalid ${name}`);
  }
}

function assertBoard(value: unknown): asserts value is 'today' | 'backlog' {
  if (!VALID_BOARDS.includes(value as any)) {
    throw new Error(`Invalid board — must be one of: ${VALID_BOARDS.join(', ')}`);
  }
}

function assertPriority(value: unknown): asserts value is 'high' | 'medium' | 'low' {
  if (!VALID_PRIORITIES.includes(value as any)) {
    throw new Error(`Invalid priority — must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
}

function assertLinkType(value: unknown): asserts value is 'related' | 'blocks' | 'blocked_by' {
  if (!VALID_LINK_TYPES.includes(value as any)) {
    throw new Error(`Invalid link type — must be one of: ${VALID_LINK_TYPES.join(', ')}`);
  }
}

function assertText(value: unknown, name: string, maxLen: number): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLen) {
    throw new Error(`${name} must be a non-empty string with at most ${maxLen} characters`);
  }
}

function isNeutralinoAvailable(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).Neutralino !== 'undefined';
}

// ─── Tasks ───────────────────────────────────────────────────

function getTasks(board?: string): Task[] {
  if (board !== undefined) {
    assertBoard(board);
    return queryAll<Task>('SELECT * FROM tasks WHERE board = ? ORDER BY done ASC, position ASC', [board]);
  }
  return queryAll<Task>('SELECT * FROM tasks ORDER BY board, done ASC, position ASC');
}

function getTask(id: string): Task | undefined {
  assertUuid(id);
  return queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
}

function createTask(task: CreateTaskInput): Task {
  assertText(task.title, 'title', MAX_TITLE_LENGTH);
  assertBoard(task.board);
  assertPriority(task.priority);
  if (task.description !== undefined && task.description !== null) {
    if (typeof task.description !== 'string' || task.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
    }
  }

  const id = uuidv4();
  const maxPos = queryOne<{ 'MAX(position)': number | null }>(
    'SELECT MAX(position) FROM tasks WHERE board = ?',
    [task.board]
  );
  const position = ((maxPos?.['MAX(position)']) ?? 0) + 1;

  execute(
    `INSERT INTO tasks (id, title, description, board, priority, position)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, task.title, task.description || null, task.board, task.priority, position]
  );

  return queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id])!;
}

function updateTask(id: string, updates: UpdateTaskInput): Task | null {
  assertUuid(id);
  const allowed = ['title', 'description', 'priority', 'board', 'position'] as const;
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (!(key in updates) || updates[key as keyof UpdateTaskInput] === undefined) continue;
    const val = updates[key as keyof UpdateTaskInput];

    if (key === 'title') assertText(val, 'title', MAX_TITLE_LENGTH);
    if (key === 'description') {
      if (val !== null && val !== undefined) {
        if (typeof val !== 'string' || val.length > MAX_DESCRIPTION_LENGTH) {
          throw new Error(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
        }
      }
    }
    if (key === 'board') assertBoard(val);
    if (key === 'priority') assertPriority(val);
    if (key === 'position') {
      if (typeof val !== 'number' || val < 0) {
        throw new Error('position must be a non-negative number');
      }
    }

    fields.push(`${key} = ?`);
    values.push(val);
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = datetime('now')`);
  values.push(id);

  execute(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
  return queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]) || null;
}

function deleteTask(id: string): { success: boolean } {
  assertUuid(id);
  execute('DELETE FROM tasks WHERE id = ?', [id]);
  return { success: true };
}

function toggleTask(id: string): Task {
  assertUuid(id);
  execute(
    `UPDATE tasks SET done = NOT done, updated_at = datetime('now') WHERE id = ?`,
    [id]
  );
  return queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id])!;
}

function moveTask(id: string, board: string): Task {
  assertUuid(id);
  assertBoard(board);

  const maxPos = queryOne<{ 'MAX(position)': number | null }>(
    'SELECT MAX(position) FROM tasks WHERE board = ?',
    [board]
  );
  const position = ((maxPos?.['MAX(position)']) ?? 0) + 1;

  execute(
    `UPDATE tasks SET board = ?, position = ?, updated_at = datetime('now') WHERE id = ?`,
    [board, position, id]
  );
  return queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id])!;
}

function reorderTask(id: string, newPosition: number): Task {
  assertUuid(id);
  if (typeof newPosition !== 'number' || newPosition < 0) {
    throw new Error('newPosition must be a non-negative number');
  }
  execute(
    `UPDATE tasks SET position = ?, updated_at = datetime('now') WHERE id = ?`,
    [newPosition, id]
  );
  return queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id])!;
}

function searchTasks(query: string): Task[] {
  assertText(query, 'query', MAX_SEARCH_LENGTH);
  const pattern = `%${query}%`;
  return queryAll<Task>(
    'SELECT * FROM tasks WHERE title LIKE ? ORDER BY board, position ASC',
    [pattern]
  );
}

function deleteOlderThan(days: number): { deleted: number } {
  if (!Number.isInteger(days) || days <= 0 || days > 36500) {
    throw new Error('days must be an integer between 1 and 36500');
  }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  execute('DELETE FROM tasks WHERE created_at < ?', [cutoff]);
  const deleted = getChanges();
  return { deleted };
}

// ─── Task Links ──────────────────────────────────────────────

function getTaskLinks(taskId: string): TaskLink[] {
  assertUuid(taskId, 'taskId');
  return queryAll<TaskLink>(
    `SELECT tl.*,
            st.title as source_title,
            tt.title as target_title
     FROM task_links tl
     JOIN tasks st ON st.id = tl.source_task_id
     JOIN tasks tt ON tt.id = tl.target_task_id
     WHERE tl.source_task_id = ? OR tl.target_task_id = ?`,
    [taskId, taskId]
  );
}

function createTaskLink(link: CreateTaskLinkInput): TaskLink {
  assertUuid(link.sourceTaskId, 'sourceTaskId');
  assertUuid(link.targetTaskId, 'targetTaskId');
  assertLinkType(link.type);

  if (link.sourceTaskId === link.targetTaskId) {
    throw new Error('A task cannot link to itself');
  }

  const sourceExists = queryOne('SELECT 1 FROM tasks WHERE id = ?', [link.sourceTaskId]);
  const targetExists = queryOne('SELECT 1 FROM tasks WHERE id = ?', [link.targetTaskId]);
  if (!sourceExists || !targetExists) {
    throw new Error('One or both tasks do not exist');
  }

  const id = uuidv4();
  execute(
    `INSERT INTO task_links (id, source_task_id, target_task_id, type) VALUES (?, ?, ?, ?)`,
    [id, link.sourceTaskId, link.targetTaskId, link.type]
  );

  return queryOne<TaskLink>('SELECT * FROM task_links WHERE id = ?', [id])!;
}

function deleteTaskLink(id: string): { success: boolean } {
  assertUuid(id);
  execute('DELETE FROM task_links WHERE id = ?', [id]);
  return { success: true };
}

// ─── App ─────────────────────────────────────────────────────

async function getAppInfo(): Promise<AppInfo> {
  if (isNeutralinoAvailable()) {
    const Neutralino = (window as any).Neutralino;
    const config = await Neutralino.app.getConfig();
    return {
      version: config.version || __APP_VERSION__,
      name: 'FasterYou',
      platform: navigator.platform,
      electronVersion: 'N/A (NeutralinoJS)',
      nodeVersion: 'N/A (WebAssembly)',
    };
  }
  return {
    version: __APP_VERSION__,
    name: 'FasterYou',
    platform: navigator.platform,
    electronVersion: 'N/A (Web)',
    nodeVersion: 'N/A (Web)',
  };
}

async function openExternal(url: string): Promise<void> {
  if (isNeutralinoAvailable()) {
    const Neutralino = (window as any).Neutralino;
    await Neutralino.os.open(url);
  } else {
    window.open(url, '_blank');
  }
}

// ─── Data Export/Import ──────────────────────────────────────

interface ExportData {
  version: number;
  exportedAt: string;
  tasks: Task[];
  taskLinks: TaskLink[];
}

function isValidExport(data: unknown): data is ExportData {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.version === 1 && Array.isArray(d.tasks) && Array.isArray(d.taskLinks);
}

async function exportData(): Promise<{ success: boolean }> {
  const tasks = queryAll<Task>('SELECT * FROM tasks');
  const taskLinks = queryAll<TaskLink>('SELECT * FROM task_links');

  const payload: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    taskLinks,
  };

  const jsonStr = JSON.stringify(payload, null, 2);

  if (isNeutralinoAvailable()) {
    const Neutralino = (window as any).Neutralino;
    const defaultName = `fasteryou-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const homePath = await Neutralino.os.getPath('downloads').catch(() => null)
      ?? await Neutralino.os.getPath('home').catch(() => null)
      ?? (window as any).NL_PATH;
    const defaultPath = `${homePath}/${defaultName}`;

    await Neutralino.window.focus();
    const filePath = await Neutralino.os.showSaveDialog('Export Data', {
      defaultPath,
      filters: [{ name: 'JSON files', extensions: ['json'] }],
    });

    if (!filePath) return { success: false };

    await Neutralino.filesystem.writeFile(filePath, jsonStr);
    return { success: true };
  } else {
    // Web: use File System Access API for save dialog, fallback to blob download
    const defaultName = `fasteryou-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultName,
          types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        return { success: true };
      } catch (e: any) {
        if (e.name === 'AbortError') return { success: false };
        throw e;
      }
    }
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  }
}

async function importData(): Promise<{ success: boolean; taskCount?: number }> {
  let jsonStr: string;

  if (isNeutralinoAvailable()) {
    const Neutralino = (window as any).Neutralino;
    await Neutralino.window.focus();
    const entries = await Neutralino.os.showOpenDialog('Import Data', {
      filters: [{ name: 'JSON files', extensions: ['json'] }],
      multiselect: false,
    });

    if (!entries || entries.length === 0) return { success: false };

    jsonStr = await Neutralino.filesystem.readFile(entries[0]);
  } else {
    // Web fallback: file input
    jsonStr = await new Promise<string>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return reject(new Error('No file selected'));
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      };
      input.click();
    });
  }

  const data = JSON.parse(jsonStr);

  if (!isValidExport(data)) {
    throw new Error('Invalid backup file format');
  }

  transaction(() => {
    execute('DELETE FROM task_links');
    execute('DELETE FROM tasks');

    for (const t of data.tasks as unknown as Record<string, unknown>[]) {
      if (
        typeof t.id !== 'string' || !UUID_RE.test(t.id) ||
        typeof t.title !== 'string' || t.title.length === 0 ||
        !VALID_BOARDS.includes(t.board as any) ||
        !VALID_PRIORITIES.includes(t.priority as any)
      ) {
        throw new Error('Invalid task data in backup');
      }
      execute(
        `INSERT INTO tasks (id, title, description, done, board, priority, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          t.id,
          t.title,
          t.description ?? null,
          t.done ?? 0,
          t.board,
          t.priority,
          t.position ?? 0,
          t.created_at ?? new Date().toISOString(),
          t.updated_at ?? new Date().toISOString(),
        ]
      );
    }

    for (const l of data.taskLinks as unknown as Record<string, unknown>[]) {
      if (
        typeof l.id !== 'string' || !UUID_RE.test(l.id) ||
        typeof l.source_task_id !== 'string' || !UUID_RE.test(l.source_task_id) ||
        typeof l.target_task_id !== 'string' || !UUID_RE.test(l.target_task_id) ||
        !VALID_LINK_TYPES.includes(l.type as any)
      ) {
        throw new Error('Invalid task link data in backup');
      }
      execute(
        `INSERT INTO task_links (id, source_task_id, target_task_id, type, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          l.id,
          l.source_task_id,
          l.target_task_id,
          l.type,
          l.created_at ?? new Date().toISOString(),
        ]
      );
    }
  });

  await forceSave();
  return { success: true, taskCount: data.tasks.length };
}

// ─── Unified API Object ─────────────────────────────────────

const api = {
  tasks: {
    getAll: async (board?: string) => {
      if (serverMode) return (await sf('/tasks' + (board ? `?board=${encodeURIComponent(board)}` : ''))).tasks;
      return getTasks(board);
    },
    get: async (id: string) => {
      if (serverMode) return sf(`/tasks/${id}`);
      return getTask(id)!;
    },
    create: async (task: CreateTaskInput) => {
      if (serverMode) return sf('/tasks', { method: 'POST', body: JSON.stringify(task) });
      return createTask(task);
    },
    update: async (id: string, updates: UpdateTaskInput) => {
      if (serverMode) return sf(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
      return updateTask(id, updates)!;
    },
    delete: async (id: string) => {
      if (serverMode) return sf(`/tasks/${id}`, { method: 'DELETE' });
      return deleteTask(id);
    },
    toggle: async (id: string) => {
      if (serverMode) return sf(`/tasks/${id}/toggle`, { method: 'POST' });
      return toggleTask(id);
    },
    move: async (id: string, board: string) => {
      if (serverMode) return sf(`/tasks/${id}/move`, { method: 'POST', body: JSON.stringify({ board }) });
      return moveTask(id, board);
    },
    reorder: async (id: string, newPosition: number) => {
      if (serverMode) return sf(`/tasks/${id}/reorder`, { method: 'POST', body: JSON.stringify({ position: newPosition }) });
      return reorderTask(id, newPosition);
    },
    search: async (query: string) => {
      if (serverMode) return (await sf(`/tasks/search?q=${encodeURIComponent(query)}`)).tasks;
      return searchTasks(query);
    },
    deleteOlderThan: async (days: number) => {
      if (serverMode) return sf('/tasks/older-than', { method: 'DELETE', body: JSON.stringify({ days }) });
      return deleteOlderThan(days);
    },
  },
  taskLinks: {
    get: async (taskId: string) => {
      if (serverMode) return (await sf(`/task-links/${taskId}`)).links;
      return getTaskLinks(taskId);
    },
    create: async (link: CreateTaskLinkInput) => {
      if (serverMode) return sf('/task-links', { method: 'POST', body: JSON.stringify(link) });
      return createTaskLink(link);
    },
    delete: async (id: string) => {
      if (serverMode) return sf(`/task-links/${id}`, { method: 'DELETE' });
      return deleteTaskLink(id);
    },
  },
  app: {
    getInfo: () => getAppInfo(),
    openExternal: (url: string) => openExternal(url),
  },
  data: {
    export: async () => {
      if (serverMode) {
        const payload = await sf('/export');
        const jsonStr = JSON.stringify(payload, null, 2);
        const defaultName = `fasteryou-backup-${new Date().toISOString().slice(0, 10)}.json`;
        if ('showSaveFilePicker' in window) {
          try {
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: defaultName,
              types: [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonStr);
            await writable.close();
            return { success: true };
          } catch (e: any) {
            if (e.name === 'AbortError') return { success: false };
            throw e;
          }
        }
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true };
      }
      return exportData();
    },
    import: async () => {
      if (serverMode) {
        const jsonStr = await new Promise<string>((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return reject(new Error('No file selected'));
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
          };
          input.click();
        });
        const data = JSON.parse(jsonStr);
        return sf('/import', { method: 'POST', body: JSON.stringify(data) });
      }
      return importData();
    },
  },
};

export default api;
