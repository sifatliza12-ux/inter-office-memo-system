import { useEffect, useRef, useState } from 'react';

import { MoreIcon } from '../icons.jsx';

// Minimal dropdown-on-click menu — built from plain React state and the
// existing Tailwind/animation tokens (no new dependency). Only dismisses on
// an outside click or Escape, never on a click inside the panel, so a form
// living inside it (e.g. a redirect target + comment) can be interacted
// with freely before the user explicitly closes or submits.
function OverflowMenu({ label = 'More actions', align = 'right', className = '', children }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className="inline-flex items-center justify-center rounded-lg px-1.5 py-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
      >
        <MoreIcon className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div
          role="menu"
          className={`animate-fade-in-up absolute z-20 mt-1.5 w-64 rounded-lg border border-stone-200 bg-white p-3 shadow-card-hover ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default OverflowMenu;
