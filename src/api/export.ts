import { queryAll, execute, transaction, forceSave } from '../db';
import { sf, isServerMode } from './http';
import { UUID_RE, VALID_BOARDS, VALID_PRIORITIES, VALID_LINK_TYPES } from './validation';
import type { Task, TaskLink, AppInfo } from '../types';

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

function isNeutralinoAvailable(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).Neutralino !== 'undefined';
}

async function exportDataLocal(): Promise<{ success: boolean }> {
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
    return saveJsonToWeb(jsonStr);
  }
}

async function saveJsonToWeb(jsonStr: string): Promise<{ success: boolean }> {
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

function readFileFromInput(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
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

async function importDataLocal(): Promise<{ success: boolean; taskCount?: number }> {
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
    jsonStr = await readFileFromInput();
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
        `INSERT INTO tasks (id, title, description, done, board, priority, position, due_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          t.id,
          t.title,
          t.description ?? null,
          t.done ?? 0,
          t.board,
          t.priority,
          t.position ?? 0,
          t.due_date ?? null,
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

// ─── App Info ────────────────────────────────────────────────

export async function getAppInfo(): Promise<AppInfo> {
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

export async function openExternal(url: string): Promise<void> {
  if (isNeutralinoAvailable()) {
    const Neutralino = (window as any).Neutralino;
    await Neutralino.os.open(url);
  } else {
    window.open(url, '_blank');
  }
}

// ─── Unified Export/Import ───────────────────────────────────

export async function exportData(): Promise<{ success: boolean }> {
  if (isServerMode()) {
    const payload = await sf('/export');
    const jsonStr = JSON.stringify(payload, null, 2);
    return saveJsonToWeb(jsonStr);
  }
  return exportDataLocal();
}

export async function importData(): Promise<{ success: boolean; taskCount?: number }> {
  if (isServerMode()) {
    const jsonStr = await readFileFromInput();
    const data = JSON.parse(jsonStr);
    return sf('/import', { method: 'POST', body: JSON.stringify(data) });
  }
  return importDataLocal();
}
