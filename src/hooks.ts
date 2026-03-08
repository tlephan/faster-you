import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';
import type { Task, CreateTaskInput, UpdateTaskInput, CreateTaskLinkInput } from './types';

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
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previous = qc.getQueryData<Task[]>(['tasks', undefined]);
      if (previous) {
        qc.setQueryData<Task[]>(['tasks', undefined], (old) =>
          old?.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['tasks', undefined], context.previous);
      }
      logMutationError('updateTask')(_err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previous = qc.getQueryData<Task[]>(['tasks', undefined]);
      if (previous) {
        qc.setQueryData<Task[]>(['tasks', undefined], (old) =>
          old?.filter((t) => t.id !== id)
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(['tasks', undefined], context.previous);
      }
      logMutationError('deleteTask')(_err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tasks.toggle(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previous = qc.getQueryData<Task[]>(['tasks', undefined]);
      if (previous) {
        qc.setQueryData<Task[]>(['tasks', undefined], (old) =>
          old?.map((t) => (t.id === id ? { ...t, done: t.done ? 0 : 1 } : t))
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(['tasks', undefined], context.previous);
      }
      logMutationError('toggleTask')(_err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useMoveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, board }: { id: string; board: string }) => api.tasks.move(id, board),
    onMutate: async ({ id, board }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previous = qc.getQueryData<Task[]>(['tasks', undefined]);
      if (previous) {
        qc.setQueryData<Task[]>(['tasks', undefined], (old) =>
          old?.map((t) => (t.id === id ? { ...t, board: board as Task['board'] } : t))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['tasks', undefined], context.previous);
      }
      logMutationError('moveTask')(_err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useReorderTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, position }: { id: string; position: number }) =>
      api.tasks.reorder(id, position),
    onMutate: async ({ id, position }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previous = qc.getQueryData<Task[]>(['tasks', undefined]);
      if (previous) {
        qc.setQueryData<Task[]>(['tasks', undefined], (old) =>
          old?.map((t) => (t.id === id ? { ...t, position } : t))
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(['tasks', undefined], context.previous);
      }
      logMutationError('reorderTask')(_err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
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
