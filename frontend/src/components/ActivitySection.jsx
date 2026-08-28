import { useCallback, useEffect, useState } from 'react';

import { getComments, createComment } from '../services/comments';
import { useToast } from '../context/ToastContext.jsx';
import { ActionBadge } from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import Textarea from './ui/Textarea.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import EmptyState from './ui/EmptyState.jsx';

function CommentEntry({ comment }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50/60 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-stone-800">{comment.authorId?.name || 'Unknown'}</span>
        <span className="text-xs text-stone-400">{new Date(comment.createdAt).toLocaleString()}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-stone-700">{comment.text}</p>
    </div>
  );
}

// Visually lighter than a comment bubble — a system/workflow event, not
// something a person wrote. Same distinction the badge/dot language uses
// everywhere else in the app, just condensed.
function ActionEntry({ action }) {
  return (
    <div className="flex items-start gap-2.5 py-1 text-sm">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium text-stone-500">{action.actor?.name || 'Unknown'}</span>
          <ActionBadge action={action.action} className="text-xs" />
        </div>
        {action.recipient?.name && <p className="text-xs text-stone-400">&rarr; sent to {action.recipient.name}</p>}
        {action.comment && <p className="mt-0.5 text-xs italic text-stone-500">&ldquo;{action.comment}&rdquo;</p>}
        <p className="mt-0.5 text-xs text-stone-400">{new Date(action.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

// Phase 5 — "safe interleave": comments and workflow actions keep coming
// from their existing, separate endpoints (comments fetched here exactly as
// before; actions are already fetched once by the parent alongside the
// workflow timeline, and passed in — not re-fetched). The merge into one
// visual stream happens only here, on the frontend, for display; nothing
// about how either is fetched, stored, or authorized changes.
function ActivitySection({ memoId, canComment, actions }) {
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getComments(memoId);
      setComments(data.comments);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [memoId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    if (!text.trim()) {
      setSubmitError('Comment text is required');
      return;
    }

    setBusy(true);
    try {
      await createComment(memoId, text.trim());
      setText('');
      await fetchComments();
      toast.success('Comment posted');
    } catch (submitErr) {
      const message = submitErr.response?.data?.message || 'Failed to post comment';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const items = [
    ...comments.map((comment) => ({ kind: 'comment', key: `c-${comment._id}`, date: comment.createdAt, comment })),
    ...(actions || []).map((action) => ({ kind: 'action', key: `a-${action._id}`, date: action.createdAt, action })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div>
      <p className="text-sm font-semibold text-stone-800">Activity</p>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <div className="mt-3 space-y-2">
        {loading ? (
          <LoadingSpinner size="sm" label="Loading activity..." className="justify-start" />
        ) : items.length === 0 ? (
          <EmptyState title="No activity yet" message="Comments and workflow events will appear here." className="py-6" />
        ) : (
          items.map((item) =>
            item.kind === 'comment' ? (
              <CommentEntry key={item.key} comment={item.comment} />
            ) : (
              <ActionEntry key={item.key} action={item.action} />
            )
          )
        )}
      </div>

      {canComment && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="Add a comment..." />
          <Button type="submit" variant="secondary" size="sm" disabled={busy}>
            Post Comment
          </Button>
        </form>
      )}
    </div>
  );
}

export default ActivitySection;
