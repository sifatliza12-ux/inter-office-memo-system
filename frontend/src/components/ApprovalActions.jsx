import { useState } from 'react';

import { approveMemo, rejectMemo, requestChanges } from '../services/workflow';

function ApprovalActions({ memoId, onActionComplete }) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const runAction = async (action) => {
    setError('');
    setBusy(true);
    try {
      await action();
      setComment('');
      await onActionComplete();
    } catch (actionError) {
      setError(actionError.response?.data?.message || 'That action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border border-blue-200 bg-blue-50 p-4">
      <p className="text-sm font-medium text-blue-900">It is your turn to act on this memo.</p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-2">
        <label className="block text-sm font-medium text-gray-700">Comment</label>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Optional for Approve; required for Reject and Request Changes"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction(() => approveMemo(memoId, comment || undefined))}
          className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction(() => requestChanges(memoId, comment))}
          className="rounded bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
        >
          Request Changes
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => runAction(() => rejectMemo(memoId, comment))}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

export default ApprovalActions;
