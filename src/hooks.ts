import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';
import type { CreateTaskInput, UpdateTaskInput, CreateTaskLinkInput } from './types';

function logMutationError(operation: string) {
  return (error: Error) => {
    console.error(`[${operation}] failed:`, error.message);
  };
}

export function useTasks(board?: string) {
  return useQuery({
    queryKey: ['tasks', board],
    queryFn: () => api.tasks.getAll(board),
  });
}

export function useSearchTasks(query: string) {
  return useQuery({
    queryKey: ['tasks', 'search', query],
    queryFn: () => api.tasks.search(query),
    enabled: query.length > 0,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: CreateTaskInput) => api.tasks.create(task),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: logMutationError('createTask'),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateTaskInput }) =>
      api.tasks.update(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: logMutationError('updateTask'),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: logMutationError('deleteTask'),
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.toggle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: logMutationError('toggleTask'),
  });
}

export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, board }: { id: string; board: string }) => api.tasks.move(id, board),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: logMutationError('moveTask'),
  });
}

export function useReorderTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, position }: { id: string; position: number }) =>
      api.tasks.reorder(id, position),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: logMutationError('reorderTask'),
  });
}

export function useTaskLinks(taskId: string) {
  return useQuery({
    queryKey: ['taskLinks', taskId],
    queryFn: () => api.taskLinks.get(taskId),
    enabled: !!taskId,
  });
}

export function useCreateTaskLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (link: CreateTaskLinkInput) => api.taskLinks.create(link),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taskLinks'] });
    },
    onError: logMutationError('createTaskLink'),
  });
}

export function useDeleteTaskLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.taskLinks.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taskLinks'] });
    },
    onError: logMutationError('deleteTaskLink'),
  });
}

export function useAppInfo() {
  return useQuery({
    queryKey: ['appInfo'],
    queryFn: () => api.app.getInfo(),
  });
}
