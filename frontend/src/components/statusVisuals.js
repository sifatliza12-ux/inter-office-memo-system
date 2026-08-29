import {
  PencilIcon,
  PaperPlaneIcon,
  ClockIcon,
  ArrowForwardIcon,
  CheckIcon,
  DoubleCheckIcon,
  XIcon,
  DeclineRedirectIcon,
  PlusIcon,
  MinusIcon,
} from './icons.jsx';

// Stage 4a, Section 2 — the single source of truth for the blue+tangerine
// workflow status/action color mapping. Every surface that colors a status
// or action (StatusBadge/ActionBadge, the participant workspace, the
// workflow timeline, the audit log, dashboard summaries) looks its own
// vocabulary up against this table via STATUS_VISUAL_KEYS below, rather than
// declaring its own colors — so the mapping can't drift between screens.
// Never rely on hue alone: every entry pairs a color with its own icon and
// label text, never just a dot.
export const STATUS_VISUALS = {
  draft: {
    dot: 'bg-stone-400',
    text: 'text-stone-600',
    ring: 'ring-stone-100',
    chipBorder: 'border-dashed border-stone-300',
    chipBg: 'bg-stone-50',
    Icon: PencilIcon,
    label: 'Draft',
  },
  submitted: {
    dot: 'bg-blue-500',
    text: 'text-blue-700',
    ring: 'ring-blue-100',
    Icon: PaperPlaneIcon,
    label: 'Submitted',
  },
  pending: {
    dot: 'bg-blue-600',
    text: 'text-blue-700',
    ring: 'ring-blue-100',
    Icon: ClockIcon,
    label: 'Pending',
  },
  current: {
    dot: 'bg-blue-600',
    text: 'text-blue-700',
    ring: 'ring-blue-100',
    Icon: ClockIcon,
    label: 'Current',
  },
  redirected: {
    dot: 'bg-blue-800',
    text: 'text-blue-900',
    ring: 'ring-blue-200',
    Icon: ArrowForwardIcon,
    label: 'Redirected',
  },
  approved: {
    dot: 'bg-blue-900',
    text: 'text-blue-900',
    ring: 'ring-blue-200',
    Icon: CheckIcon,
    label: 'Approved',
  },
  completed: {
    dot: 'bg-blue-900',
    text: 'text-blue-900',
    ring: 'ring-blue-200',
    Icon: DoubleCheckIcon,
    label: 'Completed',
  },
  changes_requested: {
    // dot is a literal filled UI-component circle (AuditLog, timeline
    // connectors) judged against the 3:1 non-text threshold, not the 4.5:1
    // text one that `text` above is held to — -500 measured 2.8:1 against
    // white; -600 measures ~3.6:1. `text`/`Icon` colors are unaffected.
    dot: 'bg-tangerine-600',
    text: 'text-tangerine-700',
    ring: 'ring-tangerine-100',
    Icon: PencilIcon,
    label: 'Changes Requested',
  },
  declined_redirected: {
    dot: 'bg-tangerine-700',
    text: 'text-tangerine-800',
    ring: 'ring-tangerine-200',
    Icon: DeclineRedirectIcon,
    label: 'Declined & Redirected',
  },
  rejected: {
    dot: 'bg-tangerine-900',
    text: 'text-tangerine-900',
    ring: 'ring-tangerine-200',
    Icon: XIcon,
    label: 'Rejected',
  },
  // Muted gray-BLUE tint (Tailwind's `slate`, not `stone`) — deliberately a
  // different neutral than Draft's warm `stone`, so "not started" (draft)
  // and "administrative event" (participant add/remove) read as distinct
  // kinds of neutral rather than identical grays.
  // dot bumped one step (slate-400 -> -500) from the text/Icon tone: -400
  // measured 2.56:1 as a filled circle against white, under the 3:1
  // non-text minimum; -500 measures ~4.9:1.
  participant_added: {
    dot: 'bg-slate-500',
    text: 'text-slate-600',
    ring: 'ring-slate-100',
    Icon: PlusIcon,
    label: 'Participant Added',
  },
  participant_removed: {
    dot: 'bg-slate-500',
    text: 'text-slate-600',
    ring: 'ring-slate-100',
    Icon: MinusIcon,
    label: 'Participant Removed',
  },
  removed: {
    dot: 'bg-slate-500',
    text: 'text-slate-500',
    ring: 'ring-slate-100',
    Icon: MinusIcon,
    label: 'Removed',
  },
  author: {
    dot: 'bg-stone-500',
    text: 'text-stone-500',
    ring: 'ring-stone-100',
    Icon: null,
    label: 'Author',
  },
};

const FALLBACK_VISUAL = { dot: 'bg-stone-500', text: 'text-stone-600', ring: 'ring-stone-100', Icon: null };

export const getStatusVisual = (key) => STATUS_VISUALS[key] || { ...FALLBACK_VISUAL, label: key || '—' };
