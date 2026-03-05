import { useState } from 'react';
import type { Task } from '../types';
import { useTasks, useCreateTaskLink } from '../hooks';

interface LinkTaskDialogProps {
  open: boolean;
  onClose: () => void;
  sourceTask: Task | null;
}

export function LinkTaskDialog({ open, onClose, sourceTask }: LinkTaskDialogProps) {
  const [search, setSearch] = useState('');
  const [linkType, setLinkType] = useState<'related' | 'blocks' | 'blocked_by'>('related');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: allTasks } = useTasks();
  const createLink = useCreateTaskLink();

  if (!open || !sourceTask) return null;

  const filteredTasks = (allTasks || []).filter(
    (t: Task) =>
      t.id !== sourceTask.id &&
      t.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleLink = () => {
    if (!selectedTaskId) return;
    createLink.mutate(
      { sourceTaskId: sourceTask.id, targetTaskId: selectedTaskId, type: linkType },
      {
        onSuccess: () => {
          setSearch('');
          setSelectedTaskId(null);
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Link to task</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Search */}
          <div>
            <label className="text-sm font-medium">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search tasks..."
              autoFocus
            />
          </div>

          {/* Link Type */}
          <div>
            <label className="text-sm font-medium">Type</label>
            <div className="mt-1 flex gap-4">
              {(['related', 'blocks', 'blocked_by'] as const).map((type) => (
                <label key={type} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="linkType"
                    value={type}
                    checked={linkType === type}
                    onChange={() => setLinkType(type)}
                    className="accent-primary"
                  />
                  {type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </label>
              ))}
            </div>
          </div>

          {/* Task List */}
          <div className="max-h-48 overflow-y-auto rounded-md border">
            {filteredTasks.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No tasks found</p>
            ) : (
              filteredTasks.map((task: Task) => (
                <label
                  key={task.id}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-secondary ${
                    selectedTaskId === task.id ? 'bg-secondary' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="selectedTask"
                    checked={selectedTaskId === task.id}
                    onChange={() => setSelectedTaskId(task.id)}
                    className="accent-primary"
                  />
                  {task.title}
                </label>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleLink}
              disabled={!selectedTaskId}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
