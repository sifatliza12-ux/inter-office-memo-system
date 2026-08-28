import { useState } from 'react';

import { approveMemo, rejectMemo, requestChanges } from '../services/workflow';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Textarea from './ui/Textarea.jsx';

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
    <Card className="border-plum-200 bg-plum-50/60">
      <p className="text-sm font-medium text-plum-900">It is your turn to act on this memo.</p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-stone-700">Comment</label>
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          placeholder="Optional for Approve; required for Reject and Request Changes"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300"
          disabled={busy}
          onClick={() => runAction(() => approveMemo(memoId, comment || undefined))}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-300"
          disabled={busy}
          onClick={() => runAction(() => requestChanges(memoId, comment))}
        >
          Request Changes
        </Button>
        <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => runAction(() => rejectMemo(memoId, comment))}>
          Reject
        </Button>
      </div>
    </Card>
  );
}

export default ApprovalActions;
