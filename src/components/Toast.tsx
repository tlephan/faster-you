import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Undo2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface ToastItem {
  id: number;
  message: string;
  onUndo?: () => void;
  duration?: number;
}

let toastId = 0;
let addToastFn: ((toast: Omit<ToastItem, 'id'>) => void) | null = null;

export function toast(message: string, options?: { onUndo?: () => void; duration?: number }) {
  addToastFn?.({ message, ...options });
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastEntry key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastEntry({ toast: t, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(t.id), 200);
  }, [t.id, onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, t.duration || 5000);
    return () => clearTimeout(timerRef.current);
  }, [dismiss, t.duration]);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg transition-all duration-200',
        exiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'
      )}
    >
      <span className="text-sm">{t.message}</span>
      {t.onUndo && (
        <button
          onClick={() => { t.onUndo?.(); dismiss(); }}
          className="flex items-center gap-1 rounded-md bg-orange-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-orange-600"
        >
          <Undo2 className="h-3 w-3" />
          Undo
        </button>
      )}
      <button
        onClick={dismiss}
        className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
