import { useState } from 'react';

import { approveMemo, rejectMemo, requestChanges, redirectMemo, declineRedirectMemo } from '../services/workflow';
import { useToast } from '../context/ToastContext.jsx';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Textarea from './ui/Textarea.jsx';
import Select from './ui/Select.jsx';
import OverflowMenu from './ui/OverflowMenu.jsx';
import { CheckIcon } from './icons.jsx';

const SUCCESS_DELAY_MS = 450;

// Action hierarchy per Stage 3 spec: Approve is primary (strongest),
// Request Changes secondary, Reject destructive-but-restrained (outline,
// not solid), and Redirect / Decline & Redirect — the least common pair —
// live in the "More actions" overflow menu. Every action below still calls
// the exact same service function, with the exact same arguments, as
// before this restructuring: approveMemo(memoId, comment||undefined),
// rejectMemo(memoId, comment), requestChanges(memoId, comment),
// redirectMemo(memoId, userId, comment), declineRedirectMemo(memoId,
// userId, comment) — only the visual layout changed.
function ApprovalActions({ memoId, users, onActionComplete }) {
  const toast = useToast();
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
        toast.success(label);
        setSuccessLabel(label);
        await new Promise((resolve) => setTimeout(resolve, SUCCESS_DELAY_MS));
      }
      await onActionComplete();
    } catch (actionError) {
      const message = actionError.response?.data?.message || 'That action failed';
      setError(message);
      toast.error(message);
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
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-plum-900">It is your turn to act on this memo.</p>
        <OverflowMenu label="More actions">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Redirect to someone specific</p>
          <Select value={redirectTarget} onChange={(event) => setRedirectTarget(event.target.value)} className="!py-1.5 text-sm">
            <option value="">Select a user...</option>
            {users.map((user) => (
              <option key={user._id} value={user._id}>
                {user.name} ({user.email})
              </option>
            ))}
          </Select>
          <p className="mt-2 text-xs text-stone-400">Uses the comment field below — required for both options here.</p>
          <div className="mt-2 flex flex-col gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => runRedirectAction(redirectMemo, 'Redirected')}
              className="w-full justify-center"
            >
              Redirect to...
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => runRedirectAction(declineRedirectMemo, 'Declined & Redirected')}
              className="w-full justify-center"
            >
              Decline &amp; Redirect to...
            </Button>
          </div>
        </OverflowMenu>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3">
        <label className="mb-1 block text-sm font-medium text-stone-700">Comment</label>
        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          placeholder="Optional for Approve — required for every other action"
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
          variant="outline"
          size="sm"
          className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 focus-visible:ring-red-200"
          disabled={busy}
          onClick={() => runAction(() => rejectMemo(memoId, comment), 'Rejected')}
        >
          Reject
        </Button>
      </div>
    </Card>
  );
}

export default ApprovalActions;
