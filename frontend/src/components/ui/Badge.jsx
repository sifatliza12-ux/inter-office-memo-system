const COLOR_CLASSES = {
  neutral: 'bg-stone-100 text-stone-700',
  plum: 'bg-plum-50 text-plum-700',
  terracotta: 'bg-terracotta-50 text-terracotta-700',
};

// Generic pill tag — for role, category, priority, event-type labels, etc.
export function Badge({ color = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_CLASSES[color] || COLOR_CLASSES.neutral} ${className}`}
    >
      {children}
    </span>
  );
}

const STATUS_CONFIG = {
  draft: { dot: 'bg-stone-400', text: 'text-stone-600', label: 'Draft' },
  submitted: { dot: 'bg-blue-500', text: 'text-blue-700', label: 'Submitted' },
  changes_requested: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Changes Requested' },
  approved: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Approved' },
  rejected: { dot: 'bg-red-500', text: 'text-red-700', label: 'Rejected' },
  pending: { dot: 'bg-stone-400', text: 'text-stone-500', label: 'Pending' },
};

// Dot-based workflow/memo status indicator — used for both memo.status and
// WorkflowStep.status, which share the same value set plus 'pending'.
export function StatusBadge({ status, label, className = '' }) {
  const config = STATUS_CONFIG[status] || { dot: 'bg-stone-400', text: 'text-stone-600', label: status || '—' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${config.text} ${className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${config.dot}`} aria-hidden="true" />
      {label || config.label}
    </span>
  );
}

export default Badge;
