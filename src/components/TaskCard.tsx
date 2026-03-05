import { useState } from 'react';
import type { Task, TaskLink } from '../types';
import {
  useToggleTask,
  useMoveTask,
  useTaskLinks,
} from '../hooks';
import { cn } from '../lib/utils';
import {
  GripVertical,

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

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onLinkTask: (task: Task) => void;
}

export function TaskCard({ task, onEdit, onLinkTask }: TaskCardProps) {
  const toggleTask = useToggleTask();

  const moveTask = useMoveTask();
  const { data: links } = useTaskLinks(task.id);
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
  const taskLinks = links || [];

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
          onClick={() =>
            moveTask.mutate({ id: task.id, board: targetBoard })
          }
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
}
