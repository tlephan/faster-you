import type React from 'react';
import { useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import { useAppInfo } from '../hooks';
import api from '../api';

type FontSize = 'small' | 'medium' | 'large';
type Theme = 'light' | 'dark' | 'system';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (value: Theme) => void;
  fontSize: FontSize;
  onFontSizeChange: (value: FontSize) => void;
  expirationDays: number;
  onExpirationDaysChange: (value: number) => void;
}

export function SettingsDialog({
  open,
  onClose,
  theme,
  onThemeChange,
  fontSize,
  onFontSizeChange,
  expirationDays,
  onExpirationDaysChange,
}: SettingsDialogProps) {
  const { data: appInfo } = useAppInfo();
  const queryClient = useQueryClient();
  const [dataStatus, setDataStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function handleExport() {
    setDataStatus(null);
    try {
      const result = await api.data.export();
      if (result.success) setDataStatus({ type: 'success', message: 'Data exported successfully.' });
    } catch {
      setDataStatus({ type: 'error', message: 'Export failed.' });
    }
  }

  async function handleImport() {
    setDataStatus(null);
    try {
      const result = await api.data.import();
      if (result.success) {
        await queryClient.invalidateQueries();
        setDataStatus({ type: 'success', message: `Imported ${result.taskCount} task(s).` });
      }
    } catch (err) {
      setDataStatus({ type: 'error', message: err instanceof Error ? err.message : 'Import failed.' });
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5">
          {/* Theme */}
          <div className="flex items-center justify-between border-b pb-5">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Choose your preferred appearance</p>
            </div>
            <div className="flex gap-1">
              {([
                { value: 'light', icon: <Sun className="h-3.5 w-3.5" />, label: 'Light' },
                { value: 'dark', icon: <Moon className="h-3.5 w-3.5" />, label: 'Dark' },
                { value: 'system', icon: <Monitor className="h-3.5 w-3.5" />, label: 'System' },
              ] as { value: Theme; icon: React.ReactNode; label: string }[]).map(({ value, icon, label }) => (
                <button
                  key={value}
                  onClick={() => onThemeChange(value)}
                  title={label}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs transition-colors',
                    theme === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-secondary'
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="border-b pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Font size</p>
                <p className="text-xs text-muted-foreground">Scale text across the app</p>
              </div>
              <div className="flex gap-1">
                {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => onFontSizeChange(size)}
                    className={cn(
                      'rounded-md border px-3 py-1 text-xs capitalize transition-colors',
                      fontSize === size
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-secondary'
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Expiration */}
          <div className="border-b pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-delete tasks</p>
                <p className="text-xs text-muted-foreground">Delete tasks older than N days (0 = never)</p>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={expirationDays}
                  onChange={(e) => onExpirationDaysChange(Math.max(0, Number(e.target.value)))}
                  className="w-16 rounded-md border bg-background px-2 py-1 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
            </div>
          </div>

          {/* Data */}
          <div className="border-b pb-5">
            <p className="text-sm font-medium mb-1">Data</p>
            <p className="text-xs text-muted-foreground mb-3">Export or import all tasks and links as a JSON backup</p>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-secondary transition-colors"
              >
                Export
              </button>
              <button
                onClick={handleImport}
                className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                Import (overwrites all data)
              </button>
            </div>
            {dataStatus && (
              <p className={cn('mt-2 text-xs', dataStatus.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-destructive')}>
                {dataStatus.message}
              </p>
            )}
          </div>

          {/* About */}
          <div>
            <p className="text-sm font-medium mb-2">About</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Version</span>
                <span className="font-mono">{appInfo?.version || 'x.x.x'}</span>
              </div>
              <div className="flex justify-between">
                <span>Runtime</span>
                <span className="font-mono">NeutralinoJS</span>
              </div>
              <button
                onClick={() => api.app.openExternal('https://github.com/tlephan/faster-you')}
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
                github.com/tlephan/faster-you
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t pt-4">
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
