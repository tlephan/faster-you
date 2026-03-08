import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTasks, useSearchTasks, useReorderTask, useUpdateTask } from './hooks';
import api from './api';
import { BoardColumn } from './components/BoardColumn';
import { TaskDialog } from './components/TaskDialog';
import { LinkTaskDialog } from './components/LinkTaskDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { Search, Plus, Settings, GripVertical, Zap, X } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { Task } from './types';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

type FilterType = 'all' | 'pending' | 'done';
type FontSize = 'small' | 'medium' | 'large';
type Theme = 'light' | 'dark' | 'system';

export default function App() {
  const [filter, setFilter] = useState<FilterType>(() => {
    const params = new URLSearchParams(window.location.search);
    const f = params.get('filter');
    return f === 'pending' || f === 'done' ? f : 'all';
  });

  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('theme') as Theme) || 'system'
  );

  const [fontSize, setFontSize] = useState<FontSize>(() =>
    (localStorage.getItem('font-size') as FontSize) || 'medium'
  );

  const [expirationDays, setExpirationDays] = useState<number>(() =>
    Number(localStorage.getItem('expiration-days') ?? 30)
  );

  useEffect(() => {
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = (dark: boolean) => document.documentElement.classList.toggle('dark', dark);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      apply(mq.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  useEffect(() => {
    const sizes: Record<FontSize, string> = { small: '15px', medium: '17px', large: '20px' };
    document.documentElement.style.fontSize = sizes[fontSize];
    localStorage.setItem('font-size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('expiration-days', String(expirationDays));
    if (expirationDays > 0) {
      api.tasks.deleteOlderThan(expirationDays).then(({ deleted }: { deleted: number }) => {
        if (deleted > 0) queryClient.invalidateQueries({ queryKey: ['tasks'] });
      });
    }
  }, [expirationDays]);

  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') || '';
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (searchQuery) {
      url.searchParams.set('search', searchQuery);
    } else {
      url.searchParams.delete('search');
    }
    window.history.replaceState({}, '', url.toString());
  }, [searchQuery]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (filter && filter !== 'all') {
      url.searchParams.set('filter', filter);
    } else {
      url.searchParams.delete('filter');
    }
    window.history.replaceState({}, '', url.toString());
  }, [filter]);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [linkingTask, setLinkingTask] = useState<Task | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const isDraggingDivider = useRef(false);
  const mainRef = useRef<HTMLElement>(null);

  const queryClient = useQueryClient();
  const reorderTask = useReorderTask();
  const updateTask = useUpdateTask();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingDivider.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingDivider.current || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const ratio = (ev.clientX - rect.left) / rect.width;
      setSplitRatio(Math.min(0.8, Math.max(0.2, ratio)));
    };

    const onMouseUp = () => {
      isDraggingDivider.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const { data: allTasks, isLoading } = useTasks();
  const { data: searchResults } = useSearchTasks(searchQuery);

  const tasks = searchQuery ? searchResults || [] : allTasks || [];

  const todayTasks = useMemo(
    () => tasks.filter((t: Task) => t.board === 'today').sort((a: Task, b: Task) => a.position - b.position),
    [tasks]
  );

  const backlogTasks = useMemo(
    () => tasks.filter((t: Task) => t.board === 'backlog').sort((a: Task, b: Task) => a.position - b.position),
    [tasks]
  );

  const pendingTodayTasks = useMemo(() => todayTasks.filter((t: Task) => !t.done), [todayTasks]);
  const pendingBacklogTasks = useMemo(() => backlogTasks.filter((t: Task) => !t.done), [backlogTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const draggedTask = active.data.current?.task as Task | undefined;
    if (!draggedTask) return;

    let targetBoardId: 'today' | 'backlog';
    let overTaskId: string | null = null;

    if (over.data.current?.boardId) {
      targetBoardId = over.data.current.boardId as 'today' | 'backlog';
    } else if (over.data.current?.task) {
      targetBoardId = (over.data.current.task as Task).board;
      overTaskId = over.id as string;
    } else {
      return;
    }

    const targetPendingTasks = targetBoardId === 'today' ? pendingTodayTasks : pendingBacklogTasks;

    if (draggedTask.board === targetBoardId) {
      if (!overTaskId || active.id === over.id) return;

      const activeIndex = targetPendingTasks.findIndex((t: Task) => t.id === active.id);
      const overIndex = targetPendingTasks.findIndex((t: Task) => t.id === overTaskId);

      if (activeIndex === -1 || overIndex === -1) return;

      let newPosition: number;
      if (overIndex === 0) {
        newPosition = targetPendingTasks[0].position - 1;
      } else if (overIndex === targetPendingTasks.length - 1) {
        newPosition = targetPendingTasks[targetPendingTasks.length - 1].position + 1;
      } else {
        const before = targetPendingTasks[overIndex - 1].position;
        const after = targetPendingTasks[overIndex].position;
        newPosition = (before + after) / 2;
      }

      reorderTask.mutate({ id: active.id as string, position: newPosition });
    } else {
      let newPosition: number;

      if (targetPendingTasks.length === 0) {
        newPosition = 1;
      } else if (!overTaskId) {
        newPosition = targetPendingTasks[targetPendingTasks.length - 1].position + 1;
      } else {
        const overIndex = targetPendingTasks.findIndex((t: Task) => t.id === overTaskId);
        if (overIndex === 0) {
          newPosition = targetPendingTasks[0].position - 1;
        } else {
          const before = targetPendingTasks[overIndex - 1].position;
          const after = targetPendingTasks[overIndex].position;
          newPosition = (before + after) / 2;
        }
      }

      updateTask.mutate({
        id: active.id as string,
        updates: { board: targetBoardId, position: newPosition },
      });
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  const handleCloseTaskDialog = () => {
    setTaskDialogOpen(false);
    setEditingTask(null);
  };

  const handleLinkTask = (task: Task) => {
    setLinkingTask(task);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-slate-800 dark:bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className="flex items-center gap-1.5 text-xl text-white logo-title"
            >
              <Zap className="h-5 w-5 text-orange-500 fill-orange-500 logo-icon" />
              FasterYou
            </h1>
            <button
              onClick={handleAddTask}
              className="flex h-8 items-center gap-1.5 rounded-md bg-orange-500 px-3 text-sm text-white hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>
            <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-medium text-orange-400">
              Be focused. Get today done. No excuses.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="h-8 w-80 rounded-md border border-slate-600 bg-slate-700 pl-8 pr-8 text-sm text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="h-8 rounded-md border border-slate-600 bg-slate-700 px-2 text-sm text-white outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="done">Done</option>
            </select>

            {/* Settings */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>

          </div>
        </div>
      </header>

      {/* Two-board layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <main ref={mainRef} className="flex flex-1 overflow-hidden">
          <div style={{ width: `${splitRatio * 100}%` }} className="flex overflow-hidden">
            <ErrorBoundary>
              <BoardColumn
                title="Today"
                boardId="today"
                tasks={todayTasks}
                filter={filter}
                onEdit={handleEdit}
                onLinkTask={handleLinkTask}
              />
            </ErrorBoundary>
          </div>
          <div
            className="w-1 bg-border hover:bg-primary/40 cursor-col-resize flex-shrink-0 transition-colors"
            onMouseDown={handleDividerMouseDown}
          />
          <div style={{ width: `${(1 - splitRatio) * 100}%` }} className="flex overflow-hidden">
            <ErrorBoundary>
              <BoardColumn
                title="Backlog"
                boardId="backlog"
                tasks={backlogTasks}
                filter={filter}
                onEdit={handleEdit}
                onLinkTask={handleLinkTask}
              />
            </ErrorBoundary>
          </div>
        </main>

        <DragOverlay>
          {activeTask && (
            <div className="flex items-center gap-2 rounded-lg border bg-card p-3 shadow-lg opacity-90 cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium truncate">{activeTask.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Dialogs */}
      <TaskDialog
        open={taskDialogOpen}
        onClose={handleCloseTaskDialog}
        task={editingTask}
      />
      <LinkTaskDialog
        open={!!linkingTask}
        onClose={() => setLinkingTask(null)}
        sourceTask={linkingTask}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        expirationDays={expirationDays}
        onExpirationDaysChange={setExpirationDays}
      />
    </div>
  );
}
