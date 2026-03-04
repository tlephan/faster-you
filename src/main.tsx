import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { initDatabase, forceSave } from './db';
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
    // Listen for window close — flush pending DB writes before exiting
    (window as any).Neutralino.events.on('windowClose', async () => {
      try {
        await forceSave();
      } catch (e) {
        console.error('Failed to save on exit:', e);
      }
      (window as any).Neutralino.app.exit();
    });
  }

  // Safety net: save on browser-level unload (covers unexpected closes)
  window.addEventListener('beforeunload', () => {
    forceSave().catch(() => {});
  });

  // Initialize the sql.js database
  await initDatabase();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
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
