import { createContext, useCallback, useContext, useRef, useState } from 'react';

import { CheckIcon, AlertIcon, CloseIcon } from '../components/icons.jsx';

const ToastContext = createContext(undefined);

const AUTO_DISMISS_MS = 4000;

function Toast({ variant, message, onDismiss }) {
  const isError = variant === 'error';
  return (
    <div
      role="status"
      className="animate-fade-in-up pointer-events-auto flex w-72 items-start gap-2.5 rounded-lg border border-stone-200 bg-white px-3.5 py-3 shadow-card-hover sm:w-80"
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
          isError ? 'bg-red-500' : 'bg-emerald-500'
        }`}
        aria-hidden="true"
      >
        {isError ? <AlertIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />}
      </span>
      <p className="flex-1 pt-0.5 text-sm text-stone-700">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 text-stone-400 transition-colors hover:text-stone-600"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// Minimal, lightweight toast system — plain React state + the existing
// Tailwind/animation tokens, no new npm dependency. Stacked bottom-right,
// success/error only, auto-dismissing.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (variant, message) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((previous) => [...previous, { id, variant, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const toast = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2 sm:bottom-6 sm:right-6">
        {toasts.map((item) => (
          <Toast key={item.id} variant={item.variant} message={item.message} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
