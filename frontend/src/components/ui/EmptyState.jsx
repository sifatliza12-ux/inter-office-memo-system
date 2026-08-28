function EmptyState({ title = 'Nothing here yet', message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 py-10 text-center ${className}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="mb-1 h-9 w-9 text-stone-300"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
      </svg>
      <p className="text-sm font-medium text-stone-600">{title}</p>
      {message && <p className="text-sm text-stone-400">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
