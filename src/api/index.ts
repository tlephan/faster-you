import { sf, isServerMode } from './http';
import {
  getTasks, getTask, createTask, updateTask, deleteTask,
  toggleTask, moveTask, reorderTask, searchTasks, deleteOlderThan,
  getTaskLinks, createTaskLink, deleteTaskLink,
} from './local';
import { exportData, importData, getAppInfo, openExternal } from './export';
import type { CreateTaskInput, UpdateTaskInput, CreateTaskLinkInput } from '../types';

export { detectServer } from './http';

const api = {
  tasks: {
    getAll: async (board?: string) => {
      if (isServerMode()) return (await sf('/tasks' + (board ? `?board=${encodeURIComponent(board)}` : ''))).tasks;
      return getTasks(board);
    },
    get: async (id: string) => {
      if (isServerMode()) return sf(`/tasks/${id}`);
      return getTask(id)!;
    },
    create: async (task: CreateTaskInput) => {
      if (isServerMode()) return sf('/tasks', { method: 'POST', body: JSON.stringify(task) });
      return createTask(task);
    },
    update: async (id: string, updates: UpdateTaskInput) => {
      if (isServerMode()) return sf(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
      return updateTask(id, updates)!;
    },
    delete: async (id: string) => {
      if (isServerMode()) return sf(`/tasks/${id}`, { method: 'DELETE' });
      return deleteTask(id);
    },
    toggle: async (id: string) => {
      if (isServerMode()) return sf(`/tasks/${id}/toggle`, { method: 'POST' });
      return toggleTask(id);
    },
    move: async (id: string, board: string) => {
      if (isServerMode()) return sf(`/tasks/${id}/move`, { method: 'POST', body: JSON.stringify({ board }) });
      return moveTask(id, board);
    },
    reorder: async (id: string, newPosition: number) => {
      if (isServerMode()) return sf(`/tasks/${id}/reorder`, { method: 'POST', body: JSON.stringify({ position: newPosition }) });
      return reorderTask(id, newPosition);
    },
    search: async (query: string) => {
      if (isServerMode()) return (await sf(`/tasks/search?q=${encodeURIComponent(query)}`)).tasks;
      return searchTasks(query);
    },
    deleteOlderThan: async (days: number) => {
      if (isServerMode()) return sf('/tasks/older-than', { method: 'DELETE', body: JSON.stringify({ days }) });
      return deleteOlderThan(days);
    },
  },
  taskLinks: {
    get: async (taskId: string) => {
      if (isServerMode()) return (await sf(`/task-links/${taskId}`)).links;
      return getTaskLinks(taskId);
    },
    create: async (link: CreateTaskLinkInput) => {
      if (isServerMode()) return sf('/task-links', { method: 'POST', body: JSON.stringify(link) });
      return createTaskLink(link);
    },
    delete: async (id: string) => {
      if (isServerMode()) return sf(`/task-links/${id}`, { method: 'DELETE' });
      return deleteTaskLink(id);
    },
  },
  app: {
    getInfo: () => getAppInfo(),
    openExternal: (url: string) => openExternal(url),
  },
  data: {
    export: () => exportData(),
    import: () => importData(),
  },
};

export default api;
