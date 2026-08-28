import { ActionBadge } from './ui/Badge.jsx';
import { getStatusVisual } from './statusVisuals.js';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import EmptyState from './ui/EmptyState.jsx';

// WorkflowAction.action -> the shared status-visual key, same mapping
// ActionBadge uses — the connector dot and its adjacent ActionBadge must
// always agree.
const ACTION_VISUAL_KEY = {
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

const connectorFor = (action) => {
  const visual = getStatusVisual(ACTION_VISUAL_KEY[action]);
  return `${visual.dot} ${visual.ring}`;
};

// Administrative events, not workflow decisions — deliberately smaller
// visual weight (smaller dot, muted text) than APPROVED/DECLINED/etc.
const MINOR_ACTIONS = new Set(['PARTICIPANT_ADDED', 'PARTICIPANT_REMOVED']);

function VersionMarker({ versionNumber, version, isLast }) {
  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <span className="z-10 mt-1 h-2.5 w-2.5 shrink-0 rotate-45 bg-stone-300" aria-hidden="true" />
        {!isLast && <span className="mt-1 w-px flex-1 bg-stone-200" aria-hidden="true" />}
      </div>
      <div className="flex-1 pb-1">
        <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-stone-500">
          Version {versionNumber} created
        </span>
        {version?.createdAt && (
          <span className="ml-2 text-xs text-stone-400">{new Date(version.createdAt).toLocaleString()}</span>
        )}
      </div>
    </li>
  );
}

// Rich entry: event name first (what happened), then when, then who, then
// any further detail (recipient/comment) — "what → when → who" rather than
// the flatter name+badge row this replaced.
function ActionEntry({ action, isLast }) {
  const minor = MINOR_ACTIONS.has(action.action);
  const connector = connectorFor(action.action);

  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`z-10 mt-1 shrink-0 rounded-full ring-4 ${connector} ${minor ? 'h-2 w-2' : 'h-2.5 w-2.5'}`}
          aria-hidden="true"
        />
        {!isLast && <span className="mt-1 w-px flex-1 bg-stone-200" aria-hidden="true" />}
      </div>
      <div className={`flex-1 pb-1 ${minor ? 'opacity-80' : ''}`}>
        <ActionBadge action={action.action} className={minor ? 'text-xs' : 'text-sm font-semibold'} />
        <p className="mt-1 text-xs text-stone-400">{new Date(action.createdAt).toLocaleString()}</p>
        <p className="mt-1 text-sm text-stone-700">{action.actor?.name || 'Unknown'}</p>
        {action.recipient?.name && (
          <p className="mt-0.5 text-sm text-stone-500">
            &rarr; sent to <span className="font-medium text-stone-700">{action.recipient.name}</span>
          </p>
        )}
        {action.comment && <p className="mt-1 text-sm italic text-stone-600">&ldquo;{action.comment}&rdquo;</p>}
      </div>
    </li>
  );
}

// Synthetic node representing the current pending step — sourced entirely
// from workflowSteps (already fetched by the parent alongside memo/actions,
// no new query). WorkflowAction only ever records things that HAVE
// happened, so there is no "awaiting approval" action to render otherwise;
// this is the one place this timeline shows something that hasn't happened
// yet, distinguished with an outlined (not filled) dot and a pulse.
function CurrentStepEntry({ step, isLast }) {
  const visual = getStatusVisual('current');
  const ClockIcon = visual.Icon;
  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <span className="relative z-10 mt-1 flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${visual.dot} ring-4 ${visual.ring}`} />
        </span>
        {!isLast && <span className="mt-1 w-px flex-1 bg-stone-200" aria-hidden="true" />}
      </div>
      <div className="flex-1 pb-1">
        <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${visual.text}`}>
          <ClockIcon className="h-3.5 w-3.5 shrink-0" />
          Awaiting action
        </span>
        <p className="mt-1 text-sm text-stone-700">{step.userId?.name || 'Unknown'}</p>
      </div>
    </li>
  );
}

// Future, not-yet-reached participants — muted/outlined, clearly distinct
// from both completed (filled, colored) and current (pulsing) entries.
function FutureStepEntry({ step, isLast }) {
  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className="z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-stone-300 bg-white"
          aria-hidden="true"
        />
        {!isLast && <span className="mt-1 w-px flex-1 bg-stone-200" aria-hidden="true" />}
      </div>
      <div className="flex-1 pb-1 opacity-70">
        <span className="text-sm font-medium text-stone-500">Upcoming</span>
        <p className="mt-1 text-sm text-stone-500">{step.userId?.name || 'Unknown'}</p>
      </div>
    </li>
  );
}

// Unified "Memo History" timeline (Stage 13d), refined for Stage 3's rich
// workflow timeline. Built entirely from data the parent (MemoDetail) has
// already fetched via GET /api/memos/:id/actions, GET /api/memos/:id/versions,
// and GET /api/memos/:id/workflow — no new data source or query, and no
// separate loading/fetch effect of its own anymore (the parent's single
// page-level load covers all of it).
function MemoHistoryTimeline({ actions, versions, workflowSteps, loading, error }) {
  if (loading) {
    return <LoadingSpinner label="Loading history..." className="justify-start" />;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  const pendingSteps = (workflowSteps || []).filter((step) => step.status === 'pending');
  const [currentStep, ...futureSteps] = pendingSteps;

  if (actions.length === 0 && !currentStep) {
    return <EmptyState title="No history yet" message="This memo has not been submitted yet." />;
  }

  // Interleaves a "Version N created" marker at every point the action
  // stream's versionNumber changes from the previous action — including
  // before the very first action, so a plain memo that never used any
  // Stage 13c feature still shows a clear "Version 1 created" lead-in
  // rather than starting mid-story.
  const versionByNumber = new Map(versions.map((version) => [version.versionNumber, version]));
  const items = [];
  let lastVersionNumber = null;
  actions.forEach((action) => {
    if (action.versionNumber !== lastVersionNumber) {
      items.push({ kind: 'version', versionNumber: action.versionNumber });
      lastVersionNumber = action.versionNumber;
    }
    items.push({ kind: 'action', action });
  });
  if (currentStep) {
    items.push({ kind: 'current', step: currentStep });
  }
  futureSteps.forEach((step) => items.push({ kind: 'future', step }));

  return (
    <ol className="space-y-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (item.kind === 'version') {
          return (
            <VersionMarker
              key={`version-${item.versionNumber}`}
              versionNumber={item.versionNumber}
              version={versionByNumber.get(item.versionNumber)}
              isLast={isLast}
            />
          );
        }
        if (item.kind === 'current') {
          return <CurrentStepEntry key={`current-${item.step._id}`} step={item.step} isLast={isLast} />;
        }
        if (item.kind === 'future') {
          return <FutureStepEntry key={`future-${item.step._id}`} step={item.step} isLast={isLast} />;
        }
        return <ActionEntry key={item.action._id} action={item.action} isLast={isLast} />;
      })}
    </ol>
  );
}

export default MemoHistoryTimeline;
