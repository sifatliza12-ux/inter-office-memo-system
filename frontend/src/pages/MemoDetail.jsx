import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getMemo, deleteMemo, submitMemo, exportMemoPdf } from '../services/memos';
import { getWorkflow, resubmitMemo } from '../services/workflow';
import { getDirectory } from '../services/directory';
import { useAuth } from '../context/AuthContext.jsx';
import ApprovalActions from '../components/ApprovalActions.jsx';
import AddParticipantControl from '../components/AddParticipantControl.jsx';
import WorkflowTimeline from '../components/WorkflowTimeline.jsx';
import CommentsSection from '../components/CommentsSection.jsx';
import AttachmentsSection from '../components/AttachmentsSection.jsx';
import NavBar from '../components/NavBar.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

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
  const [exporting, setExporting] = useState(false);

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

  const handleExportPdf = async () => {
    setActionError('');
    setExporting(true);
    try {
      await exportMemoPdf(id, memo.referenceNumber);
    } catch (exportError) {
      setActionError(exportError.response?.data?.message || 'Failed to export PDF');
    } finally {
      setExporting(false);
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
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-50">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/memos" className="text-sm font-medium text-plum-700 hover:underline">
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

  const metaItems = [
    { label: 'Priority', value: <span className="capitalize">{memo.priority}</span> },
    { label: 'Category', value: memo.category },
    { label: 'Department', value: departmentName(memo.departmentId) || 'None' },
    { label: 'Author', value: userName(memo.authorId) },
    { label: 'Created', value: new Date(memo.createdAt).toLocaleString() },
    { label: 'Updated', value: new Date(memo.updatedAt).toLocaleString() },
  ];
  if (memo.submittedAt) {
    metaItems.push({ label: 'Submitted', value: new Date(memo.submittedAt).toLocaleString() });
  }
  if (memo.finalApprovedAt) {
    metaItems.push({
      label: 'Final approval',
      value: `${new Date(memo.finalApprovedAt).toLocaleString()} by ${userName(memo.finalApproverId)}`,
    });
  }

  return (
    <div className="min-h-screen bg-stone-50 pt-16 lg:pl-60">
      <NavBar />
      <div className="mx-auto max-w-6xl animate-fade-in-up space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-terracotta-500">
              {memo.referenceNumber}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{memo.subject}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export PDF'}
            </Button>
            <Link to="/memos" className="text-sm font-medium text-plum-700 hover:underline">
              Back to My Memos
            </Link>
          </div>
        </div>

        {actionError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: memo content */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                {metaItems.map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs uppercase tracking-wide text-stone-400">{item.label}</dt>
                    <dd className="mt-0.5 text-stone-800">{item.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 border-t border-stone-100 pt-5">
                <p className="text-sm font-medium text-stone-700">Body</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{memo.body}</p>
              </div>
            </Card>

            <Card padded={false}>
              <div className="border-b border-stone-100 px-5 py-4 sm:px-6">
                <AttachmentsSection memoId={id} canUpload={canComment} currentUserId={currentUserId} isAuthor={isAuthor} />
              </div>
              <div className="px-5 py-4 sm:px-6">
                <CommentsSection memoId={id} canComment={canComment} />
              </div>
            </Card>
          </div>

          {/* Right: status, workflow, actions */}
          <div className="space-y-6">
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Current status</p>
              <div className="mt-1.5">
                <StatusBadge status={memo.status} className="text-base" />
              </div>
            </Card>

            <Card>
              <p className="text-sm font-medium text-stone-700">Workflow Timeline</p>
              <div className="mt-3">
                <WorkflowTimeline steps={workflowSteps} />
              </div>
            </Card>

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
              <Card className="flex flex-wrap gap-2">
                <Link to={`/memos/${id}/edit`}>
                  <Button variant="secondary" size="sm">
                    Edit
                  </Button>
                </Link>
                <Button variant="primary" size="sm" onClick={handleSubmit} disabled={busy}>
                  Submit
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete} disabled={busy}>
                  Delete
                </Button>
              </Card>
            )}

            {isChangesRequested && isAuthor && (
              <Card className="flex flex-wrap gap-2">
                <Link to={`/memos/${id}/edit`}>
                  <Button variant="secondary" size="sm">
                    Edit
                  </Button>
                </Link>
                <Button variant="primary" size="sm" onClick={handleResubmit} disabled={busy}>
                  Resubmit
                </Button>
              </Card>
            )}

            {!isDraft && !isChangesRequested && !isCurrentApprover && !canAddParticipant && (
              <p className="text-sm text-stone-500">This memo is read-only for you at this stage.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemoDetail;
