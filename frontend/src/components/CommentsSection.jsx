import { useCallback, useEffect, useState } from 'react';

import { getComments, createComment } from '../services/comments';
import Button from './ui/Button.jsx';
import Textarea from './ui/Textarea.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';

// General discussion comments — a separate thread from the "Workflow
// History" timeline above it, which shows the approve/reject/request-changes
// comments recorded on each WorkflowStep. Different data, different purpose.
function CommentsSection({ memoId, canComment }) {
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
    } catch (submitErr) {
      setSubmitError(submitErr.response?.data?.message || 'Failed to post comment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-sm font-medium text-stone-700">Comments</p>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <div className="mt-2 space-y-2">
        {loading ? (
          <LoadingSpinner size="sm" label="Loading comments..." className="justify-start" />
        ) : comments.length === 0 ? (
          <p className="text-sm text-stone-400">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment._id} className="rounded-md border border-stone-200 bg-stone-50/60 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-stone-800">{comment.authorId?.name || 'Unknown'}</span>
                <span className="text-xs text-stone-400">{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-stone-700">{comment.text}</p>
            </div>
          ))
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

export default CommentsSection;
