export interface Task {
  id: string;
  title: string;
  description: string | null;
  done: number; // 0 or 1 from SQLite
  board: 'today' | 'backlog';
  priority: 'high' | 'medium' | 'low';
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskLink {
  id: string;
  source_task_id: string;
  target_task_id: string;
  type: 'related' | 'blocks' | 'blocked_by';
  created_at: string;
  source_title?: string;
  target_title?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  board: 'today' | 'backlog';
  priority: 'high' | 'medium' | 'low';
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  board?: 'today' | 'backlog';
  position?: number;
}

export interface CreateTaskLinkInput {
  sourceTaskId: string;
  targetTaskId: string;
  type: 'related' | 'blocks' | 'blocked_by';
}

export interface AppInfo {
  version: string;
  name: string;
  platform: string;
  electronVersion: string;
  nodeVersion: string;
}
