import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute, getChanges } from '../db';
import type { Task, TaskLink, CreateTaskInput, UpdateTaskInput, CreateTaskLinkInput } from '../types';
import {
  assertUuid, assertBoard, assertPriority, assertLinkType, assertText,
  MAX_TITLE_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_SEARCH_LENGTH,
} from './validation';

// ─── Tasks ───────────────────────────────────────────────────

export function getTasks(board?: string): Task[] {
  if (board !== undefined) {
    assertBoard(board);
    return queryAll<Task>('SELECT * FROM tasks WHERE board = ? ORDER BY done ASC, position ASC', [board]);
  }
  return queryAll<Task>('SELECT * FROM tasks ORDER BY board, done ASC, position ASC');
}

export function getTask(id: string): Task | undefined {
  assertUuid(id);
  return queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
}

export function createTask(task: CreateTaskInput): Task {
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

export function updateTask(id: string, updates: UpdateTaskInput): Task | null {
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

export function deleteTask(id: string): { success: boolean } {
  assertUuid(id);
  execute('DELETE FROM tasks WHERE id = ?', [id]);
  return { success: true };
}

export function toggleTask(id: string): Task {
  assertUuid(id);
  execute(
    `UPDATE tasks SET done = NOT done, updated_at = datetime('now') WHERE id = ?`,
    [id]
  );
  return queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id])!;
}

export function moveTask(id: string, board: string): Task {
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

export function reorderTask(id: string, newPosition: number): Task {
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

export function searchTasks(query: string): Task[] {
  assertText(query, 'query', MAX_SEARCH_LENGTH);
  const pattern = `%${query}%`;
  return queryAll<Task>(
    'SELECT * FROM tasks WHERE title LIKE ? OR description LIKE ? ORDER BY board, position ASC',
    [pattern, pattern]
  );
}

export function deleteOlderThan(days: number): { deleted: number } {
  if (!Number.isInteger(days) || days <= 0 || days > 36500) {
    throw new Error('days must be an integer between 1 and 36500');
  }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  execute('DELETE FROM tasks WHERE done = 1 AND created_at < ?', [cutoff]);
  const deleted = getChanges();
  return { deleted };
}

// ─── Task Links ──────────────────────────────────────────────

export function getTaskLinks(taskId: string): TaskLink[] {
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

export function createTaskLink(link: CreateTaskLinkInput): TaskLink {
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

export function deleteTaskLink(id: string): { success: boolean } {
  assertUuid(id);
  execute('DELETE FROM task_links WHERE id = ?', [id]);
  return { success: true };
}
