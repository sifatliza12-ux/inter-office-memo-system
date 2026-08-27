import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getMemo, deleteMemo, submitMemo } from '../services/memos';
import { getDirectory } from '../services/directory';

function MemoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [memo, setMemo] = useState(null);
  const [directory, setDirectory] = useState({ users: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchMemo = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getMemo(id);
      setMemo(data.memo);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load memo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMemo();
  }, [fetchMemo]);

  useEffect(() => {
    getDirectory()
      .then(({ data }) => setDirectory(data))
      .catch(() => setDirectory({ users: [], departments: [] }));
  }, []);

  const departmentName = (deptId) => directory.departments.find((department) => department._id === deptId)?.name;
  const userName = (userId) => directory.users.find((user) => user._id === userId)?.name || userId;

  const handleDelete = async () => {
    setActionError('');
    setBusy(true);
    try {
      await deleteMemo(id);
      navigate('/memos');
    } catch (deleteError) {
      setActionError(deleteError.response?.data?.message || 'Failed to delete memo');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    setActionError('');
    setBusy(true);
    try {
      await submitMemo(id);
      await fetchMemo();
    } catch (submitError) {
      setActionError(submitError.response?.data?.message || 'Failed to submit memo');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/memos" className="text-sm text-blue-600 hover:underline">
          Back to My Memos
        </Link>
      </div>
    );
  }

  const isDraft = memo.status === 'draft';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-4 rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">{memo.subject}</h1>
            <p className="text-sm text-gray-500">{memo.referenceNumber}</p>
          </div>
          <Link to="/memos" className="text-sm text-blue-600 hover:underline">
            Back to My Memos
          </Link>
        </div>

        {actionError && <p className="text-sm text-red-600">{actionError}</p>}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Status:</span> {memo.status}
          </div>
          <div>
            <span className="text-gray-500">Priority:</span> {memo.priority}
          </div>
          <div>
            <span className="text-gray-500">Category:</span> {memo.category}
          </div>
          <div>
            <span className="text-gray-500">Department:</span> {departmentName(memo.departmentId) || 'None'}
          </div>
          <div>
            <span className="text-gray-500">Created:</span> {new Date(memo.createdAt).toLocaleString()}
          </div>
          <div>
            <span className="text-gray-500">Updated:</span> {new Date(memo.updatedAt).toLocaleString()}
          </div>
          {memo.submittedAt && (
            <div>
              <span className="text-gray-500">Submitted:</span> {new Date(memo.submittedAt).toLocaleString()}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Body</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{memo.body}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Workflow participant sequence</p>
          {memo.workflowParticipants && memo.workflowParticipants.length > 0 ? (
            <ol className="mt-1 list-decimal pl-5 text-sm text-gray-800">
              {memo.workflowParticipants.map((participantId) => (
                <li key={participantId}>{userName(participantId)}</li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-sm text-gray-400">No participants selected yet.</p>
          )}
        </div>

        {isDraft ? (
          <div className="flex gap-2 pt-2">
            <Link
              to={`/memos/${id}/edit`}
              className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
            >
              Edit
            </Link>
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Submit
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ) : (
          <p className="pt-2 text-sm text-gray-500">This memo has been submitted and is read-only.</p>
        )}
      </div>
    </div>
  );
}

export default MemoDetail;
