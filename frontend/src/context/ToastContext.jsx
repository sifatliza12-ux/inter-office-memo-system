import { createContext, useCallback, useContext, useRef, useState } from 'react';

import { CheckIcon, AlertIcon, CloseIcon } from '../components/icons.jsx';

const ToastContext = createContext(undefined);

const AUTO_DISMISS_MS = 4000;
const EXIT_DURATION_MS = 180;

function Toast({ variant, message, leaving, onDismiss }) {
  const isError = variant === 'error';
  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-72 items-start gap-2.5 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-card-hover transition-all duration-200 ease-out sm:w-80 ${
        leaving ? 'translate-x-2 opacity-0' : 'animate-fade-in-up opacity-100'
      }`}
    >
      <span className={`h-full w-1 shrink-0 ${isError ? 'bg-tangerine-600' : 'bg-gradient-to-b from-blue-600 to-blue-900'}`} aria-hidden="true" />
      <span
        className={`mt-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
          isError ? 'bg-tangerine-600' : 'bg-blue-900'
        }`}
        aria-hidden="true"
      >
        {isError ? <AlertIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />}
      </span>
      <p className="flex-1 py-3 pr-1 text-sm text-stone-700">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="mr-2.5 mt-3 shrink-0 text-stone-400 transition-colors hover:text-stone-600"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

// Minimal, lightweight toast system — plain React state + the existing
// Tailwind/animation tokens, no new npm dependency. Stacked bottom-right,
// success/error only, auto-dismissing. A thin gradient accent bar (blue for
// success, tangerine for error) is the only "gradient" here — restrained,
// per Section 9 — and dismissal fades/slides out over the exit duration
// before actually leaving the DOM, rather than vanishing instantly.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const remove = useCallback((id) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const dismiss = useCallback(
    (id) => {
      setToasts((previous) => previous.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
      setTimeout(() => remove(id), EXIT_DURATION_MS);
    },
    [remove]
  );

  const push = useCallback(
    (variant, message) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((previous) => [...previous, { id, variant, message, leaving: false }]);
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
          <Toast key={item.id} variant={item.variant} message={item.message} leaving={item.leaving} onDismiss={() => dismiss(item.id)} />
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
