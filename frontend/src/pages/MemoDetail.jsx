import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getMemo, deleteMemo, submitMemo, exportMemoPdf, getMemoVersions } from '../services/memos';
import { getWorkflow, resubmitMemo, getWorkflowActions } from '../services/workflow';
import { getDirectory } from '../services/directory';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ApprovalActions from '../components/ApprovalActions.jsx';
import ParticipantWorkspace from '../components/ParticipantWorkspace.jsx';
import MemoHistoryTimeline from '../components/MemoHistoryTimeline.jsx';
import MemoMetadataBar from '../components/MemoMetadataBar.jsx';
import ActivitySection from '../components/ActivitySection.jsx';
import AttachmentsSection from '../components/AttachmentsSection.jsx';
import AppShell from '../components/AppShell.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import OverflowMenu from '../components/ui/OverflowMenu.jsx';

function MemoDetailSkeleton() {
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-72 max-w-full" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MemoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [memo, setMemo] = useState(null);
  const [workflowSteps, setWorkflowSteps] = useState([]);
  const [actions, setActions] = useState([]);
  const [versions, setVersions] = useState([]);
  const [directory, setDirectory] = useState({ users: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchAll = useCallback(async () => {
    setError('');
    try {
      const [memoResponse, workflowResponse, actionsResponse, versionsResponse] = await Promise.all([
        getMemo(id),
        getWorkflow(id),
        getWorkflowActions(id),
        getMemoVersions(id),
      ]);
      setMemo(memoResponse.data.memo);
      setWorkflowSteps(workflowResponse.data.workflowSteps);
      setActions(actionsResponse.data.actions);
      setVersions(versionsResponse.data.versions);
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
      toast.success('Memo deleted');
      navigate('/memos');
    } catch (deleteError) {
      const message = deleteError.response?.data?.message || 'Failed to delete memo';
      setActionError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    setActionError('');
    setBusy(true);
    try {
      await submitMemo(id);
      toast.success('Memo submitted for approval');
      await fetchAll();
    } catch (submitError) {
      const message = submitError.response?.data?.message || 'Failed to submit memo';
      setActionError(message);
      toast.error(message);
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
      const message = exportError.response?.data?.message || 'Failed to export PDF';
      setActionError(message);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const handleResubmit = async () => {
    setActionError('');
    setBusy(true);
    try {
      await resubmitMemo(id);
      toast.success('Memo resubmitted for approval');
      await fetchAll();
    } catch (resubmitError) {
      const message = resubmitError.response?.data?.message || 'Failed to resubmit memo';
      setActionError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <MemoDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-100 via-blue-50 to-tangerine-50">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/memos" className="text-sm font-medium text-blue-700 hover:underline">
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
  const canManageParticipants = isAnyParticipant && memo.status === 'submitted';
  // Matches the backend's comment authorization exactly (author, or anyone
  // with a WorkflowStep regardless of status) — deliberately not the same
  // as canManageParticipants above, which also requires status === 'submitted'.
  const canComment = isAuthor || isAnyParticipant;

  const metaItems = [
    { label: 'Priority', value: <span className="capitalize">{memo.priority}</span> },
    { label: 'Category', value: memo.category },
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
    <AppShell>
      <div className="mx-auto max-w-6xl animate-fade-in-up space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-tangerine-500">
              {memo.referenceNumber}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{memo.subject}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export PDF'}
            </Button>
            <Link to="/memos" className="text-sm font-medium text-blue-700 hover:underline">
              Back to My Memos
            </Link>
          </div>
        </div>

        <MemoMetadataBar memo={memo} fromLabel={userName(memo.authorId)} toLabel={departmentName(memo.departmentId)} />

        {actionError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

        {/* Workspace split (desktop): left = document workspace (content,
            attachments, activity/discussion); right = workflow/context
            workspace (contextual actions, workflow timeline, participants).
            Mobile reflows into a single stack via `order`, matching Section
            11's simple-stack spec (actions near status, then content, then
            workflow, then participants, then activity, then attachments).

            Each column is wrapped in its own `contents lg:flex lg:flex-col`
            container rather than every item carrying its own
            `lg:row-start-N`. With per-item row-start, both columns shared
            one grid row-track per row, so CSS Grid sized each row to its
            TALLEST occupant across BOTH columns — a short "read-only"
            message sharing row 1 with a long memo body, or a compact
            Attachments list sharing row 2 with a long Workflow timeline,
            left a large empty gap trailing the short item before the next
            section began. `self-start` (the earlier Attachments fix) only
            stops one item from stretching to fill that shared row — it
            can't shrink the row track itself, so it never could have fixed
            a gap that crosses into the *next* row (this bug). Making each
            column a real, independent flex column removes the shared
            row-track entirely — each column's height is just the sum of
            its own content, unrelated to the other column's. `contents`
            makes the wrapper itself disappear from layout on mobile, so its
            children fall back to being flat siblings of the outer grid,
            where their own `order-N` still drives the interleaved mobile
            stack exactly as before (verified unaffected: 24px on every
            adjacent pair, all 3 test cases, before and after this change). */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          {/* lg:row-start-1 on both wrappers: without it, CSS Grid's default
              auto-placement cursor advances past row 1 after placing this
              wrapper in column 3 (the last column), so the *next* DOM
              sibling (the left wrapper, needing columns 1-2) gets pushed to
              row 2 even though row 1's columns 1-2 are still empty — sparse
              packing never backtracks to fill an earlier row. Pinning both
              to row 1 explicitly is what actually puts them side by side. */}
          <div className="contents lg:col-start-3 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">
            <div className="order-1 lg:order-none">
              {isCurrentApprover && <ApprovalActions memoId={id} users={directory.users} onActionComplete={fetchAll} />}

              {isDraft && isAuthor && (
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary" size="sm" onClick={handleSubmit} disabled={busy}>
                      Submit
                    </Button>
                    <Link to={`/memos/${id}/edit`}>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </Link>
                    <div className="ml-auto">
                      <OverflowMenu label="More actions">
                        {!confirmDelete ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(true)}
                            className="text-sm font-medium text-red-600 hover:underline"
                          >
                            Delete memo
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-stone-600">Delete this memo permanently?</p>
                            <div className="flex gap-2">
                              <Button variant="danger" size="sm" disabled={busy} onClick={handleDelete}>
                                Yes, delete
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </OverflowMenu>
                    </div>
                  </div>
                </Card>
              )}

              {isChangesRequested && isAuthor && (
                <Card className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={handleResubmit} disabled={busy}>
                    Resubmit
                  </Button>
                  <Link to={`/memos/${id}/edit`}>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </Link>
                </Card>
              )}

              {!isDraft && !isChangesRequested && !isCurrentApprover && (
                <Card className="bg-stone-50/60">
                  <p className="text-sm text-stone-500">This memo is read-only for you at this stage.</p>
                </Card>
              )}
            </div>

            <Card className="order-3 lg:order-none">
              <p className="text-sm font-semibold text-stone-800">Workflow</p>
              <div className="mt-3">
                <MemoHistoryTimeline actions={actions} versions={versions} workflowSteps={workflowSteps} loading={false} error="" />
              </div>
            </Card>

            <div className="order-4 lg:order-none">
              <ParticipantWorkspace
                memo={memo}
                workflowSteps={workflowSteps}
                directory={directory}
                currentUserId={currentUserId}
                canManage={canManageParticipants}
                onActionComplete={fetchAll}
              />
            </div>
          </div>

          <div className="contents lg:col-span-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">
            <Card className="order-2 lg:order-none">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                {metaItems.map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs uppercase tracking-wide text-stone-500">{item.label}</dt>
                    <dd className="mt-0.5 text-stone-800">{item.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 border-t border-stone-100 pt-5">
                <p className="text-sm font-medium text-stone-700">Body</p>
                <p className="mt-2 max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-stone-800">{memo.body}</p>
              </div>
            </Card>

            <Card padded={false} className="order-6 lg:order-none">
              <div className="px-5 py-4 sm:px-6">
                <AttachmentsSection memoId={id} canUpload={canComment} currentUserId={currentUserId} isAuthor={isAuthor} />
              </div>
            </Card>

            <Card padded={false} className="order-5 lg:order-none">
              <div className="px-5 py-4 sm:px-6">
                <ActivitySection memoId={id} canComment={canComment} actions={actions} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default MemoDetail;
