/**
 * Database module using sql.js (SQLite compiled to WebAssembly).
 * Persists the database via NeutralinoJS filesystem API.
 */
// @ts-expect-error sql.js does not ship type declarations
import * as sqlModule from 'sql.js';
const initSqlJs: any = (sqlModule as any).default || sqlModule;
type Database = any;

let db: Database | null = null;
let dbPath: string = '';
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let savingInProgress = false;

// Detect if we are in NeutralinoJS environment
function isNeutralinoAvailable(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).Neutralino !== 'undefined';
}

async function getNeutralinoDataPath(): Promise<string> {
  const Neutralino = (window as any).Neutralino;

  // Try user's AppData/data directory first
  try {
    const homePath = await Neutralino.os.getPath('data');
    const appDir = `${homePath}/fasteryou`;

    // Ensure directory exists
    try {
      await Neutralino.filesystem.getStats(appDir);
    } catch {
      await Neutralino.filesystem.createDirectory(appDir);
    }

    // Verify we can actually write to this directory
    const testPath = `${appDir}/.write-test`;
    await Neutralino.filesystem.writeFile(testPath, 'ok');
    await Neutralino.filesystem.remove(testPath);

    console.log(`[DB] Using data path: ${appDir}/fasteryou.db`);
    return `${appDir}/fasteryou.db`;
  } catch (err) {
    console.warn('[DB] Failed to use AppData path, falling back to NL_PATH:', err);
  }

  // Fallback: use the directory where the binary is located
  const nlPath = (window as any).NL_PATH;
  if (nlPath) {
    const fallbackDir = `${nlPath}/.fasteryou-data`;
    try {
      try {
        await Neutralino.filesystem.getStats(fallbackDir);
      } catch {
        await Neutralino.filesystem.createDirectory(fallbackDir);
      }
      console.log(`[DB] Using fallback path: ${fallbackDir}/fasteryou.db`);
      return `${fallbackDir}/fasteryou.db`;
    } catch (err) {
      console.error('[DB] Failed to create fallback directory:', err);
    }
  }

  throw new Error('Could not determine a writable data path');
}

function getFallbackPath(): string {
  return 'fasteryou.db';
}

const MIGRATIONS = [
  {
    version: 1,
    up: [
      `CREATE TABLE IF NOT EXISTS tasks (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        description TEXT,
        done       INTEGER NOT NULL DEFAULT 0,
        board      TEXT NOT NULL DEFAULT 'backlog' CHECK (board IN ('today', 'backlog')),
        priority   TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
        position   REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS task_links (
        id             TEXT PRIMARY KEY,
        source_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        target_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        type           TEXT NOT NULL CHECK (type IN ('related', 'blocks', 'blocked_by')),
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(source_task_id, target_task_id, type)
      )`,
      `CREATE TABLE IF NOT EXISTS schema_version (
        version    INTEGER NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `INSERT INTO schema_version (version) VALUES (1)`,
    ],
  },
];

async function loadDbFromDisk(): Promise<Uint8Array | null> {
  if (!isNeutralinoAvailable()) return null;

  const Neutralino = (window as any).Neutralino;
  try {
    const data = await Neutralino.filesystem.readBinaryFile(dbPath);
    return new Uint8Array(data);
  } catch {
    // File doesn't exist yet
    return null;
  }
}

async function saveDbToDisk(): Promise<void> {
  if (!db) return;
  if (savingInProgress) return; // prevent re-entrant saves
  savingInProgress = true;

  try {
    const data = db.export();
    const uint8Array = new Uint8Array(data);

    if (isNeutralinoAvailable() && dbPath) {
      const Neutralino = (window as any).Neutralino;
      // writeBinaryFile expects ArrayBuffer
      const buffer = uint8Array.buffer.slice(
        uint8Array.byteOffset,
        uint8Array.byteOffset + uint8Array.byteLength
      );
      await Neutralino.filesystem.writeBinaryFile(dbPath, buffer);
      console.debug(`[DB] Saved ${uint8Array.byteLength} bytes to ${dbPath}`);
    } else {
      // Web mode: save to localStorage
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
      }
      localStorage.setItem('fasteryou_db', btoa(binary));
      console.debug(`[DB] Saved ${uint8Array.byteLength} bytes to localStorage`);
    }
  } catch (err) {
    console.error('[DB] Save failed:', err);
  } finally {
    savingInProgress = false;
  }
}

function scheduleSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDbToDisk().catch((err) => {
      console.error('Scheduled save failed:', err);
    });
  }, 300);
}

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs({
    // Load WASM binary from local bundle (copied to public/ at build time)
    locateFile: () => '/sql-wasm.wasm',
  });

  // Determine db path
  if (isNeutralinoAvailable()) {
    try {
      dbPath = await getNeutralinoDataPath();
      console.log(`[DB] Database path resolved: ${dbPath}`);
    } catch (err) {
      console.error('[DB] Failed to resolve data path:', err);
      throw err;
    }
  } else {
    dbPath = getFallbackPath();
    console.log('[DB] Web mode, using localStorage');
  }

  // Try to load existing database
  let existingData: Uint8Array | null = null;

  if (isNeutralinoAvailable()) {
    existingData = await loadDbFromDisk();
    if (existingData) {
      console.log(`[DB] Loaded database from filesystem: ${dbPath} (${existingData.byteLength} bytes)`);
    } else {
      console.log('[DB] No existing database file found, starting fresh');
    }
  } else {
    // Web mode: load from localStorage
    const stored = localStorage.getItem('fasteryou_db');
    if (stored) {
      const binary = atob(stored);
      existingData = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        existingData[i] = binary.charCodeAt(i);
      }
      console.log(`[DB] Loaded database from localStorage (${existingData.byteLength} bytes)`);
    }
  }

  if (existingData) {
    db = new SQL.Database(existingData);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Check current version
  let currentVersion = 0;
  try {
    const result = db.exec('SELECT MAX(version) as version FROM schema_version');
    if (result.length > 0 && result[0].values.length > 0) {
      currentVersion = (result[0].values[0][0] as number) || 0;
    }
  } catch {
    // Table doesn't exist yet
  }

  // Run pending migrations
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      for (const sql of migration.up) {
        db.run(sql);
      }
    }
  }

  // Save after initialization (verifies persistence works)
  await saveDbToDisk();
  console.log('[DB] Database initialized and initial save completed');
}

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

/**
 * Execute a query that returns rows (SELECT).
 */
export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params as any[]);

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

/**
 * Execute a query that returns a single row.
 */
export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  const results = queryAll<T>(sql, params);
  return results[0];
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE).
 */
export function execute(sql: string, params: unknown[] = []): void {
  const d = getDb();
  d.run(sql, params as any[]);
  scheduleSave();
}

/**
 * Execute multiple statements in a transaction.
 */
export function transaction(fn: () => void): void {
  const d = getDb();
  d.run('BEGIN TRANSACTION');
  try {
    fn();
    d.run('COMMIT');
  } catch (err) {
    d.run('ROLLBACK');
    throw err;
  }
  scheduleSave();
}

/**
 * Force save the database to disk immediately.
 */
export async function forceSave(): Promise<void> {
  if (saveTimeout) clearTimeout(saveTimeout);
  await saveDbToDisk();
}

/**
 * Get changes count from last operation.
 */
export function getChanges(): number {
  const d = getDb();
  const result = d.exec('SELECT changes()');
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0] as number;
  }
  return 0;
}

/**
 * Export the database as Uint8Array.
 */
export function exportDb(): Uint8Array {
  const d = getDb();
  return d.export();
}

/**
 * Import a database from Uint8Array.
 */
export async function importDb(data: Uint8Array): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  });
  
  if (db) {
    db.close();
  }
  
  db = new SQL.Database(data);
  db.run('PRAGMA foreign_keys = ON');
  await saveDbToDisk();
}
