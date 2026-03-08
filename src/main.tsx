import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initDatabase } from './db';
import { detectServer } from './api';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

async function bootstrap() {
  // Initialize NeutralinoJS if available
  if (typeof (window as any).Neutralino !== 'undefined') {
    await (window as any).Neutralino.init();
  }

  // In web mode, prefer the local server (shared SQLite); fall back to sql.js + IndexedDB
  const isNeutralino = typeof (window as any).Neutralino !== 'undefined';
  const usingServer = !isNeutralino && await detectServer();
  if (!usingServer) {
    await initDatabase();
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

bootstrap().catch((err) => {
  console.error('Failed to initialize app:', err);
  document.getElementById('root')!.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
      <div style="text-align:center;">
        <h2>Failed to start</h2>
        <p style="color:#888;">${err.message}</p>
      </div>
    </div>
  `;
});
