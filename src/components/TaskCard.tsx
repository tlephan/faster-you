import { useState, memo } from 'react';
import type { Task, TaskLink } from '../types';
import {
  useToggleTask,
  useMoveTask,
} from '../hooks';
import { toast } from './Toast';
import { cn } from '../lib/utils';
import {
  GripVertical,
  Calendar,
  Pencil,
  ArrowRightLeft,
  Link,
  ChevronRight,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const priorityBorder = {
  high: 'border-l-red-500',
  medium: 'border-l-yellow-400',
  low: 'border-l-green-500',
};

function getDueDateStatus(dueDate: string): { label: string; className: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `${Math.abs(diffDays)}d overdue`, className: 'text-red-500' };
  }
  if (diffDays === 0) {
    return { label: 'Due today', className: 'text-orange-500' };
  }
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays}d`, className: 'text-yellow-500' };
  }
  return { label: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), className: 'text-muted-foreground' };
}

interface TaskCardProps {
  task: Task;
  links: TaskLink[];
  onEdit: (task: Task) => void;
  onLinkTask: (task: Task) => void;
}

export const TaskCard = memo(function TaskCard({ task, links, onEdit, onLinkTask }: TaskCardProps) {
  const toggleTask = useToggleTask();

  const moveTask = useMoveTask();
  const [showLinks, setShowLinks] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task }, disabled: !!task.done });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const targetBoard = task.board === 'today' ? 'backlog' : 'today';
  const taskLinks = links;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2 rounded-lg border-y border-r bg-orange-50 dark:bg-slate-800 p-3 shadow-md transition-colors border-l-4 hover:bg-blue-50 hover:border-y-primary/50 hover:border-r-primary/50 dark:hover:bg-blue-950/30',
        priorityBorder[task.priority],
        isDragging && 'opacity-50',
        task.done && 'opacity-60'
      )}
    >
      {/* Drag handle */}
      <button
        className="mt-1 cursor-grab text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Checkbox */}
      <button
        className="mt-1 flex-shrink-0"
        onClick={() => toggleTask.mutate(task.id)}
      >
        <div
          className={cn(
            'h-4 w-4 rounded border-2 transition-colors',
            task.done
              ? 'border-primary bg-primary'
              : 'border-muted-foreground'
          )}
        >
          {task.done ? (
            <svg viewBox="0 0 14 14" className="h-full w-full text-primary-foreground">
              <path
                d="M3 7l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </div>
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-medium',
              task.done && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </span>
        </div>
        {task.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
            {task.description}
          </p>
        )}

        {/* Due Date */}
        {task.due_date && !task.done && (() => {
          const status = getDueDateStatus(task.due_date);
          return (
            <div className={cn('mt-1 flex items-center gap-1 text-xs', status.className)}>
              <Calendar className="h-3 w-3" />
              {status.label}
            </div>
          );
        })()}

        {/* Task Links */}
        {taskLinks.length > 0 && (
          <div className="mt-1">
            <button
              onClick={() => setShowLinks(!showLinks)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronRight
                className={cn('h-3 w-3 transition-transform', showLinks && 'rotate-90')}
              />
              <Link className="h-3 w-3" />
              {taskLinks.length} link{taskLinks.length !== 1 && 's'}
            </button>
            {showLinks && (
              <div className="mt-1 space-y-0.5 pl-4">
                {taskLinks.map((link: TaskLink) => {
                  const isSource = link.source_task_id === task.id;
                  const linkedTitle = isSource ? link.target_title : link.source_title;
                  const linkType = isSource
                    ? link.type
                    : link.type === 'blocks'
                      ? 'blocked_by'
                      : link.type === 'blocked_by'
                        ? 'blocks'
                        : 'related';
                  return (
                    <div key={link.id} className="text-xs text-muted-foreground">
                      🔗 {linkType.replace('_', ' ')}: {linkedTitle}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => {
            const fromBoard = task.board;
            moveTask.mutate({ id: task.id, board: targetBoard }, {
              onSuccess: () => {
                toast(`Moved to ${targetBoard}`, {
                  onUndo: () => moveTask.mutate({ id: task.id, board: fromBoard }),
                });
              },
            });
          }}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title={`Move to ${targetBoard}`}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onLinkTask(task)}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Link task"
        >
          <Link className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onEdit(task)}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});
