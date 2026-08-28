import { useState } from 'react';

import { approveMemo, rejectMemo, requestChanges, redirectMemo, declineRedirectMemo } from '../services/workflow';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Textarea from './ui/Textarea.jsx';
import Select from './ui/Select.jsx';

function ApprovalActions({ memoId, users, onActionComplete }) {
  const [comment, setComment] = useState('');
  const [redirectTarget, setRedirectTarget] = useState('');
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

  // Redirect and decline-redirect both need a target picked, in addition
  // to the shared comment field below — checked client-side first so the
  // error is immediate, then re-verified server-side regardless.
  const runRedirectAction = (apiCall) => {
    setError('');
    if (!redirectTarget) {
      setError('Select a user to redirect to');
      return;
    }
    if (!comment.trim()) {
      setError('A comment is required');
      return;
    }
    runAction(() => apiCall(memoId, redirectTarget, comment));
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
          placeholder="Optional for Approve; required for Reject, Request Changes, Redirect, and Decline & Redirect"
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

      <div className="mt-4 border-t border-stone-200 pt-3">
        <label className="mb-1 block text-sm font-medium text-stone-700">Redirect / Decline &amp; Redirect target</label>
        <Select value={redirectTarget} onChange={(event) => setRedirectTarget(event.target.value)}>
          <option value="">Select a user...</option>
          {users.map((user) => (
            <option key={user._id} value={user._id}>
              {user.name} ({user.email})
            </option>
          ))}
        </Select>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => runRedirectAction(redirectMemo)}
          >
            Redirect to...
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => runRedirectAction(declineRedirectMemo)}
          >
            Decline &amp; Redirect to...
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default ApprovalActions;
