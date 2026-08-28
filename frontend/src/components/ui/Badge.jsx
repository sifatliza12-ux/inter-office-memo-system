import { getStatusVisual } from '../statusVisuals.js';

const COLOR_CLASSES = {
  neutral: 'bg-stone-100 text-stone-700',
  blue: 'bg-blue-50 text-blue-700',
  tangerine: 'bg-tangerine-50 text-tangerine-700',
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

// memo.status -> the shared Stage 4a status-visual key (statusVisuals.js).
const STATUS_KEY_MAP = {
  draft: 'draft',
  submitted: 'submitted',
  changes_requested: 'changes_requested',
  approved: 'approved',
  rejected: 'rejected',
  pending: 'pending',
};

// Dot-based workflow/memo status indicator — used for both memo.status and
// WorkflowStep.status, which share the same value set plus 'pending'. Draft
// gets its own dashed-outline pill (per Section 2's explicit "dashed
// border" requirement) since a dashed treatment doesn't read at the size of
// a plain 8px dot; every other status stays the established compact
// dot+icon+text row.
export function StatusBadge({ status, label, className = '' }) {
  const key = STATUS_KEY_MAP[status] || status;
  const visual = getStatusVisual(key);
  const Icon = visual.Icon;
  const text = label || visual.label;

  if (key === 'draft') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ${visual.chipBorder} ${visual.chipBg} ${visual.text} ${className}`}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        {text}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 ${visual.text} ${className}`}>
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <span className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-200 ${visual.dot}`} aria-hidden="true" />
      )}
      {text}
    </span>
  );
}

// WorkflowAction.action (Stage 13b/13c) -> the shared status-visual key.
// DECLINED and DECLINED_REDIRECTED keep their own established label
// wording ("Declined", not "Rejected") even though DECLINED shares
// Rejected's color/icon — the action verb and the resulting memo status are
// named differently on purpose elsewhere in this app; only the color unifies.
const ACTION_KEY_MAP = {
  MEMO_SUBMITTED: 'submitted',
  RESUBMITTED: 'submitted',
  APPROVED: 'approved',
  DECLINED: 'rejected',
  CHANGES_REQUESTED: 'changes_requested',
  REDIRECTED: 'redirected',
  DECLINED_REDIRECTED: 'declined_redirected',
  PARTICIPANT_ADDED: 'participant_added',
  PARTICIPANT_REMOVED: 'participant_removed',
};

const ACTION_LABEL_OVERRIDE = {
  RESUBMITTED: 'Resubmitted',
  DECLINED: 'Declined',
};

export function ActionBadge({ action, label, className = '' }) {
  const key = ACTION_KEY_MAP[action];
  const visual = getStatusVisual(key);
  const Icon = visual.Icon;
  const text = label || ACTION_LABEL_OVERRIDE[action] || visual.label || action || '—';

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 ${visual.text} ${className}`}>
      {Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <span className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-200 ${visual.dot}`} aria-hidden="true" />
      )}
      {text}
    </span>
  );
}

export default Badge;
