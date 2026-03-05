import { useState } from 'react';
import type { Task } from '../types';
import { TaskCard } from './TaskCard';
import { cn } from '../lib/utils';
import { ChevronRight } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

type FilterType = 'all' | 'pending' | 'done';

interface BoardColumnProps {
  title: string;
  boardId: string;
  tasks: Task[];
  filter: FilterType;
  onEdit: (task: Task) => void;
  onLinkTask: (task: Task) => void;
}

export function BoardColumn({ title, boardId, tasks, filter, onEdit, onLinkTask }: BoardColumnProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  const pendingTasks = tasks.filter((t) => !t.done);
  const completedTasks = tasks.filter((t) => t.done);

  const visibleTasks =
    filter === 'pending'
      ? pendingTasks
      : filter === 'done'
        ? completedTasks
        : pendingTasks;

  const { setNodeRef, isOver } = useDroppable({
    id: `board-${boardId}`,
    data: { boardId },
  });

  const totalCount = tasks.length;
  const doneCount = completedTasks.length;

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
          {pendingTasks.length}
        </span>
        {boardId === 'today' && (
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · Important Things
          </span>
        )}
      </div>

      {/* Task List */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto p-3 space-y-2 transition-colors',
          isOver && 'bg-accent/20'
        )}
      >
        <SortableContext
          items={visibleTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onLinkTask={onLinkTask}
            />
          ))}
        </SortableContext>

        {visibleTasks.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tasks here
          </p>
        )}

        {/* Completed section (only in 'all' filter) */}
        {filter === 'all' && completedTasks.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronRight
                className={cn(
                  'h-3 w-3 transition-transform',
                  showCompleted && 'rotate-90'
                )}
              />
              Completed ({completedTasks.length})
            </button>
            {showCompleted && (
              <div className="mt-2 space-y-2">
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={onEdit}
                    onLinkTask={onLinkTask}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 text-xs text-muted-foreground">
        {totalCount} task{totalCount !== 1 && 's'} · {doneCount} done
      </div>
    </div>
  );
}
