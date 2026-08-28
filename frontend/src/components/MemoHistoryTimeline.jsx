import { useCallback, useEffect, useState } from 'react';

import { getWorkflowActions } from '../services/workflow';
import { getMemoVersions } from '../services/memos';
import { ActionBadge } from './ui/Badge.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import EmptyState from './ui/EmptyState.jsx';

const CONNECTOR_RING = {
  MEMO_SUBMITTED: 'bg-blue-500 ring-blue-100',
  RESUBMITTED: 'bg-blue-500 ring-blue-100',
  APPROVED: 'bg-emerald-500 ring-emerald-100',
  DECLINED: 'bg-red-500 ring-red-100',
  CHANGES_REQUESTED: 'bg-amber-500 ring-amber-100',
  REDIRECTED: 'bg-plum-500 ring-plum-100',
  DECLINED_REDIRECTED: 'bg-terracotta-500 ring-terracotta-100',
  PARTICIPANT_ADDED: 'bg-stone-400 ring-stone-100',
  PARTICIPANT_REMOVED: 'bg-stone-400 ring-stone-100',
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

function ActionEntry({ action, isLast }) {
  const minor = MINOR_ACTIONS.has(action.action);
  const connector = CONNECTOR_RING[action.action] || 'bg-stone-400 ring-stone-100';

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
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className={`font-medium ${minor ? 'text-sm text-stone-600' : 'text-sm text-stone-800'}`}>
            {action.actor?.name || 'Unknown'}
          </span>
          <ActionBadge action={action.action} />
        </div>
        {action.recipient?.name && (
          <p className="mt-0.5 text-sm text-stone-500">
            &rarr; sent to <span className="font-medium text-stone-700">{action.recipient.name}</span>
          </p>
        )}
        {action.comment && <p className="mt-1 text-sm italic text-stone-600">&ldquo;{action.comment}&rdquo;</p>}
        <p className="mt-0.5 text-xs text-stone-400">{new Date(action.createdAt).toLocaleString()}</p>
      </div>
    </li>
  );
}

// Unified "Memo History" timeline (Stage 13d) — replaces the three
// previously-separate sections (WorkflowTimeline, VersionHistorySection,
// ActionLogSection) with one view built from GET /api/memos/:id/actions
// (Stage 13b/13c) and GET /api/memos/:id/versions (Stage 13a) together.
// Both endpoints already enforce view-authorization server-side; a 403/404
// here surfaces the same way any other memo fetch error already does on
// this page.
function MemoHistoryTimeline({ memoId }) {
  const [actions, setActions] = useState([]);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [actionsResponse, versionsResponse] = await Promise.all([
        getWorkflowActions(memoId),
        getMemoVersions(memoId),
      ]);
      setActions(actionsResponse.data.actions);
      setVersions(versionsResponse.data.versions);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load memo history');
    } finally {
      setLoading(false);
    }
  }, [memoId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return <LoadingSpinner label="Loading history..." className="justify-start" />;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (actions.length === 0) {
    return <EmptyState title="No history yet" message="This memo has not been submitted yet." />;
  }

  // Interleaves a "Version N created" marker at every point the action
  // stream's versionNumber changes from the previous action — including
  // before the very first action, so a plain memo that never used any
  // Stage 13c feature still shows a clear "Version 1 created" lead-in
  // rather than starting mid-story. version metadata (createdAt) is looked
  // up from the versions endpoint; the marker still renders correctly if
  // that lookup ever comes up empty.
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

  return (
    <ol className="space-y-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return item.kind === 'version' ? (
          <VersionMarker
            key={`version-${item.versionNumber}`}
            versionNumber={item.versionNumber}
            version={versionByNumber.get(item.versionNumber)}
            isLast={isLast}
          />
        ) : (
          <ActionEntry key={item.action._id} action={item.action} isLast={isLast} />
        );
      })}
    </ol>
  );
}

export default MemoHistoryTimeline;
