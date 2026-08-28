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
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 ${config.text} ${className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-200 ${config.dot}`} aria-hidden="true" />
      {label || config.label}
    </span>
  );
}

// Separate vocabulary from STATUS_CONFIG above (WorkflowAction.action event
// types, Stage 13b/13c — MEMO_SUBMITTED/APPROVED/etc., not memo/step
// statuses) but the same dot+label visual pattern, so the memo history
// timeline (Stage 13d) reads as part of the same design language as every
// other status indicator in the app. REDIRECTED gets the plum brand accent
// (a genuinely new kind of event, not a re-colored approval);
// DECLINED_REDIRECTED gets terracotta specifically to read as distinct from
// both a plain DECLINED (red) and a plain REDIRECTED (plum) — "declined,
// but continued," not either one alone. PARTICIPANT_ADDED/REMOVED are
// muted stone — administrative, not workflow decisions.
const ACTION_CONFIG = {
  MEMO_SUBMITTED: { dot: 'bg-blue-500', text: 'text-blue-700', label: 'Submitted' },
  RESUBMITTED: { dot: 'bg-blue-500', text: 'text-blue-700', label: 'Resubmitted' },
  APPROVED: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Approved' },
  DECLINED: { dot: 'bg-red-500', text: 'text-red-700', label: 'Declined' },
  CHANGES_REQUESTED: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Changes Requested' },
  REDIRECTED: { dot: 'bg-plum-500', text: 'text-plum-700', label: 'Redirected' },
  DECLINED_REDIRECTED: { dot: 'bg-terracotta-500', text: 'text-terracotta-700', label: 'Declined & Redirected' },
  PARTICIPANT_ADDED: { dot: 'bg-stone-400', text: 'text-stone-500', label: 'Participant Added' },
  PARTICIPANT_REMOVED: { dot: 'bg-stone-400', text: 'text-stone-500', label: 'Participant Removed' },
};

export function ActionBadge({ action, label, className = '' }) {
  const config = ACTION_CONFIG[action] || { dot: 'bg-stone-400', text: 'text-stone-600', label: action || '—' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 ${config.text} ${className}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-200 ${config.dot}`} aria-hidden="true" />
      {label || config.label}
    </span>
  );
}

export default Badge;
