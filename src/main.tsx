import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles/base.css';
import App from './App';
import { createClient } from './lib/client';
import { AppProvider } from './state/AppContext';
import { ToastProvider } from './state/ToastContext';

const rootEl = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootEl);

createClient()
  .then((client) => {
    root.render(
      <React.StrictMode>
        <AppProvider client={client}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppProvider>
      </React.StrictMode>,
    );
  })
  .catch((err: unknown) => {
    // Boot failure (e.g. live mode without env vars): render a plain,
    // token-styled explanation rather than a white screen.
    const msg = err instanceof Error ? err.message : String(err);
    rootEl.innerHTML = `
      <div style="max-width:520px;margin:15vh auto;padding:2rem;background:var(--surface);
                  border:1px solid var(--border);border-radius:var(--r-panel)">
        <p class="mono-label" style="color:var(--danger)">LebanonTCG failed to start</p>
        <p style="margin-top:0.75rem;color:var(--text-1);font-size:1rem"></p>
      </div>`;
    rootEl.querySelector('p:last-child')!.textContent = msg;
  });
