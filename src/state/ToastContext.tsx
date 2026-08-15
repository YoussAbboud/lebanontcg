import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const ToastContext = createContext<(msg: string) => void>(() => {});

/** Acid toast pill, bottom-centre, 2.2s — as in the design component. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const timer = useRef<number | null>(null);

  const toast = useCallback((next: string) => {
    setMsg(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(''), 2200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {msg && (
        <div role="status" className="toast">
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): (msg: string) => void {
  return useContext(ToastContext);
}
