import { useState, useEffect } from 'react';
import type { Task } from '../types';
import { useCreateTask, useUpdateTask, useDeleteTask } from '../hooks';
import { Trash2, X, Plus, Save } from 'lucide-react';

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  task?: Task | null; // null = create, Task = edit
}

export function TaskDialog({ open, onClose, task }: TaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [board, setBoard] = useState<'today' | 'backlog'>('today');

  const [error, setError] = useState<string | null>(null);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const isEditing = !!task;
  const isPending = createTask.isPending || updateTask.isPending;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setBoard(task.board);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setBoard('today');
    }
  }, [task, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);

    const onError = (err: Error) => setError(err.message || 'Something went wrong');

    if (isEditing) {
      updateTask.mutate(
        { id: task.id, updates: { title: title.trim(), description: description.trim() || undefined, priority, board } },
        { onSuccess: onClose, onError }
      );
    } else {
      createTask.mutate(
        { title: title.trim(), description: description.trim() || undefined, priority, board },
        { onSuccess: onClose, onError }
      );
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Task' : 'Add Task'}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Task title..."
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-medium">Priority</label>
            <div className="mt-1 flex gap-4">
              {(['high', 'medium', 'low'] as const).map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    checked={priority === p}
                    onChange={() => setPriority(p)}
                    className="accent-primary"
                  />
                  {p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢'}{' '}
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Board */}
          <div>
            <label className="text-sm font-medium">Board</label>
            <div className="mt-1 flex gap-4">
              {(['today', 'backlog'] as const).map((b) => (
                <label key={b} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="board"
                    value={b}
                    checked={board === b}
                    onChange={() => setBoard(b)}
                    className="accent-primary"
                  />
                  {b.charAt(0).toUpperCase() + b.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center pt-2">
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete "${task.title}"?`)) {
                    deleteTask.mutate(task.id, { onSuccess: onClose });
                  }
                }}
                className="rounded-md border border-destructive/30 p-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                title="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <div className="flex-1" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-secondary"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || isPending}
                className="flex items-center gap-1.5 rounded-md bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {isPending ? 'Saving...' : isEditing ? <><Save className="h-4 w-4" />Save</> : <><Plus className="h-4 w-4" />Add Task</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
