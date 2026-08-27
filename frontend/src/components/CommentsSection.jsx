import { useCallback, useEffect, useState } from 'react';

import { getComments, createComment } from '../services/comments';

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
      <p className="text-sm font-medium text-gray-700">Comments</p>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <div className="mt-1 space-y-2">
        {loading ? (
          <p className="text-sm text-gray-400">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-400">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment._id} className="rounded border border-gray-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800">{comment.authorId?.name || 'Unknown'}</span>
                <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-gray-700">{comment.text}</p>
            </div>
          ))
        )}
      </div>

      {canComment && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder="Add a comment..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50"
          >
            Post Comment
          </button>
        </form>
      )}
    </div>
  );
}

export default CommentsSection;
