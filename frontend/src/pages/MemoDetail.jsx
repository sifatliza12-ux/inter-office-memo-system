import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getMemo, deleteMemo, submitMemo } from '../services/memos';
import { getWorkflow, resubmitMemo } from '../services/workflow';
import { getDirectory } from '../services/directory';
import { useAuth } from '../context/AuthContext.jsx';
import ApprovalActions from '../components/ApprovalActions.jsx';
import AddParticipantControl from '../components/AddParticipantControl.jsx';
import WorkflowTimeline from '../components/WorkflowTimeline.jsx';
import CommentsSection from '../components/CommentsSection.jsx';
import AttachmentsSection from '../components/AttachmentsSection.jsx';
import NavBar from '../components/NavBar.jsx';

function MemoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [memo, setMemo] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [directory, setDirectory] = useState({ users: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    setError('');
    try {
      const [memoResponse, workflowResponse] = await Promise.all([getMemo(id), getWorkflow(id)]);
      setMemo(memoResponse.data.memo);
      setWorkflowSteps(workflowResponse.data.workflowSteps);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load memo');
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

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
      await fetchAll();
    } catch (submitError) {
      setActionError(submitError.response?.data?.message || 'Failed to submit memo');
    } finally {
      setBusy(false);
    }
  };

  const handleResubmit = async () => {
    setActionError('');
    setBusy(true);
    try {
      await resubmitMemo(id);
      await fetchAll();
    } catch (resubmitError) {
      setActionError(resubmitError.response?.data?.message || 'Failed to resubmit memo');
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

  const currentUserId = currentUser?._id;
  const isAuthor = memo.authorId === currentUserId;
  const isDraft = memo.status === 'draft';
  const isChangesRequested = memo.status === 'changes_requested';
  const isCurrentApprover = memo.status === 'submitted' && memo.currentApproverId === currentUserId;
  const isAnyParticipant = workflowSteps.some((step) => (step.userId?._id || step.userId) === currentUserId);
  const canAddParticipant = isAnyParticipant && memo.status === 'submitted';
  // Matches the backend's comment authorization exactly (author, or anyone
  // with a WorkflowStep regardless of status) — deliberately not the same
  // as canAddParticipant above, which also requires status === 'submitted'.
  // Comments have no such restriction: they're allowed on approved/rejected
  // memos too, and for an author who never became a participant themselves.
  const canComment = isAuthor || isAnyParticipant;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="mx-auto max-w-3xl space-y-4 rounded-lg bg-white p-6 m-6 shadow">
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
            <span className="text-gray-500">Author:</span> {userName(memo.authorId)}
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
          {memo.finalApprovedAt && (
            <div>
              <span className="text-gray-500">Final approval:</span>{' '}
              {new Date(memo.finalApprovedAt).toLocaleString()} by {userName(memo.finalApproverId)}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Body</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{memo.body}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700">Workflow History</p>
          <div className="mt-1">
            <WorkflowTimeline steps={workflowSteps} />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <AttachmentsSection
            memoId={id}
            canUpload={canComment}
            currentUserId={currentUserId}
            isAuthor={isAuthor}
          />
        </div>

        <div className="border-t border-gray-200 pt-4">
          <CommentsSection memoId={id} canComment={canComment} />
        </div>

        {isCurrentApprover && <ApprovalActions memoId={id} onActionComplete={fetchAll} />}

        {canAddParticipant && (
          <AddParticipantControl
            memoId={id}
            users={directory.users}
            existingParticipantIds={memo.workflowParticipants}
            onActionComplete={fetchAll}
          />
        )}

        {isDraft && isAuthor && (
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
        )}

        {isChangesRequested && isAuthor && (
          <div className="flex gap-2 pt-2">
            <Link
              to={`/memos/${id}/edit`}
              className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
            >
              Edit
            </Link>
            <button
              onClick={handleResubmit}
              disabled={busy}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Resubmit
            </button>
          </div>
        )}

        {!isDraft && !isChangesRequested && !isCurrentApprover && !canAddParticipant && (
          <p className="pt-2 text-sm text-gray-500">This memo is read-only for you at this stage.</p>
        )}
      </div>
    </div>
  );
}

export default MemoDetail;
