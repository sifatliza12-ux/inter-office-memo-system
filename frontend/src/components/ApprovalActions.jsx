import { useState } from 'react';

import { approveMemo, rejectMemo, requestChanges, redirectMemo, declineRedirectMemo } from '../services/workflow';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Textarea from './ui/Textarea.jsx';
import Select from './ui/Select.jsx';
import { CheckIcon } from './icons.jsx';

const SUCCESS_DELAY_MS = 450;

function ApprovalActions({ memoId, users, onActionComplete }) {
  const [comment, setComment] = useState('');
  const [redirectTarget, setRedirectTarget] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [successLabel, setSuccessLabel] = useState('');

  // On success, briefly shows a confirmation state before calling
  // onActionComplete() — every action here removes this component from the
  // tree once the parent refetches (the memo is no longer awaiting this
  // user's turn), so state is deliberately left as-is afterward rather than
  // reset, since there's nothing left mounted to reset it on.
  const runAction = async (action, label) => {
    setError('');
    setBusy(true);
    try {
      await action();
      setComment('');
      if (label) {
        setSuccessLabel(label);
        await new Promise((resolve) => setTimeout(resolve, SUCCESS_DELAY_MS));
      }
      await onActionComplete();
    } catch (actionError) {
      setError(actionError.response?.data?.message || 'That action failed');
      setBusy(false);
    }
  };

  // Redirect and decline-redirect both need a target picked, in addition
  // to the shared comment field below — checked client-side first so the
  // error is immediate, then re-verified server-side regardless.
  const runRedirectAction = (apiCall, label) => {
    setError('');
    if (!redirectTarget) {
      setError('Select a user to redirect to');
      return;
    }
    if (!comment.trim()) {
      setError('A comment is required');
      return;
    }
    runAction(() => apiCall(memoId, redirectTarget, comment), label);
  };

  if (successLabel) {
    return (
      <Card className="animate-fade-in-up flex items-center gap-2.5 border-emerald-200 bg-emerald-50">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <CheckIcon className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-semibold text-emerald-800">{successLabel}</p>
      </Card>
    );
  }

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
          onClick={() => runAction(() => approveMemo(memoId, comment || undefined), 'Approved')}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-300"
          disabled={busy}
          onClick={() => runAction(() => requestChanges(memoId, comment), 'Changes Requested')}
        >
          Request Changes
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={() => runAction(() => rejectMemo(memoId, comment), 'Rejected')}
        >
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
            onClick={() => runRedirectAction(redirectMemo, 'Redirected')}
          >
            Redirect to...
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => runRedirectAction(declineRedirectMemo, 'Declined & Redirected')}
          >
            Decline &amp; Redirect to...
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default ApprovalActions;
