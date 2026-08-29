import { useState } from 'react';

import { addWorkflowParticipant, removeWorkflowParticipant, setMyRoleLabel } from '../services/workflow';
import { useToast } from '../context/ToastContext.jsx';
import { getStatusVisual } from './statusVisuals.js';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Select from './ui/Select.jsx';
import Input from './ui/Input.jsx';
import { PlusIcon, PencilIcon } from './icons.jsx';

// Real WorkflowStep-derived status — never a fabricated role like
// "Reviewer"/"Owner"/"Participant". "current" overrides "pending" for
// whichever step is the lowest-stepOrder pending one; "author" is only used
// for the memo's author when they hold no WorkflowStep of their own. Colors
// and icons come from the shared Stage 4a mapping (statusVisuals.js), never
// declared locally, so this always matches the badge/timeline/audit-log
// treatment of the same states.
const REAL_STATUS_LABEL = {
  author: 'Author',
  current: 'Current',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes Requested',
  removed: 'Removed',
};

const initials = (name) =>
  (name || '')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

function ParticipantRow({ row, onEditRole, onStartRemove, onCancelRemove, onConfirmRemove, removeState, roleState, onRoleChange, onRoleSubmit, onRoleCancel }) {
  const isRemoving = removeState.userId === row.userId;
  const isEditingRole = roleState.editing && row.editable;
  const visual = getStatusVisual(row.statusKey);
  const StatusIcon = visual.Icon;

  return (
    <li className="px-5 py-3.5 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
            {initials(row.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-800">{row.name}</p>
            {row.department && <p className="text-xs text-stone-500">{row.department}</p>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            {StatusIcon ? (
              <StatusIcon className={`h-3 w-3 shrink-0 ${visual.text}`} />
            ) : (
              <span className={`h-1.5 w-1.5 rounded-full ${visual.dot}`} aria-hidden="true" />
            )}
            <span className={visual.text}>{row.statusLabel}</span>
          </span>

          {row.editable && !isEditingRole && (
            <button
              type="button"
              onClick={() => onEditRole(row)}
              className="inline-flex items-center gap-1 text-xs text-stone-500 transition-colors hover:text-blue-700"
            >
              <PencilIcon className="h-3 w-3" />
              {row.roleLabel || 'Add role label'}
            </button>
          )}
          {!row.editable && row.roleLabel && <p className="text-xs text-stone-500">{row.roleLabel}</p>}

          {row.removable && !isRemoving && (
            <button type="button" onClick={() => onStartRemove(row.userId)} className="text-xs font-medium text-red-600 hover:underline">
              Remove
            </button>
          )}
        </div>
      </div>

      {isEditingRole && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Input
            autoFocus
            maxLength={100}
            placeholder="e.g. Legal Advisor"
            value={roleState.draft}
            onChange={(event) => onRoleChange(event.target.value)}
            className="!py-1.5 max-w-xs text-sm"
          />
          <Button type="button" size="sm" variant="secondary" disabled={roleState.busy} onClick={onRoleSubmit}>
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={roleState.busy} onClick={onRoleCancel}>
            Cancel
          </Button>
          {roleState.error && <p className="w-full text-xs text-red-600">{roleState.error}</p>}
        </div>
      )}

      {isRemoving && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Input
            autoFocus
            placeholder="Reason (required)"
            value={removeState.reason}
            onChange={(event) => removeState.onReasonChange(event.target.value)}
            className="!py-1.5 max-w-xs text-sm"
          />
          <Button type="button" size="sm" variant="danger" disabled={removeState.busy} onClick={() => onConfirmRemove(row.userId)}>
            Confirm remove
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={removeState.busy} onClick={onCancelRemove}>
            Cancel
          </Button>
          {removeState.error && <p className="w-full text-xs text-red-600">{removeState.error}</p>}
        </div>
      )}
    </li>
  );
}

// Phase 4: unified participant list. Combines the memo's author (shown
// separately only when they hold no WorkflowStep of their own) with every
// WorkflowStep, each row showing its real workflow status plus — purely as
// a secondary, user-chosen descriptive line — that participant's roleLabel
// (Pre-Stage-3). Only the signed-in user's own row ever exposes an edit
// affordance for roleLabel, matching the backend's self-only contract.
function ParticipantWorkspace({ memo, workflowSteps, directory, currentUserId, canManage, onActionComplete }) {
  const toast = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addReason, setAddReason] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');

  const [removingId, setRemovingId] = useState(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const [editingUserId, setEditingUserId] = useState(null);
  const [roleDraft, setRoleDraft] = useState('');
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState('');

  const userMeta = (userId) => directory.users.find((user) => user._id === userId);
  const departmentName = (userId) => {
    const user = userMeta(userId);
    if (!user?.departmentId) return null;
    return directory.departments.find((department) => department._id === user.departmentId)?.name || null;
  };

  const currentStep = workflowSteps.find((step) => step.status === 'pending');
  const authorHasOwnStep = workflowSteps.some((step) => (step.userId?._id || step.userId) === memo.authorId);

  const rows = [];
  if (!authorHasOwnStep) {
    rows.push({
      rowKey: 'author',
      userId: memo.authorId,
      name: userMeta(memo.authorId)?.name || 'Unknown',
      department: departmentName(memo.authorId),
      statusKey: 'author',
      statusLabel: REAL_STATUS_LABEL.author,
      roleLabel: null,
      editable: false,
      removable: false,
    });
  }
  // A participant can hold more than one WorkflowStep on the same memo —
  // resubmitMemo() (backend) re-inserts a fresh step for whoever most
  // recently requested changes, so that person keeps their old terminal
  // step *and* gains a new pending one. Both documents are real, unrelated
  // history and neither is touched here — this only groups them for
  // display, exactly once per person, so the Participant Workspace reads
  // as "one participant" rather than showing the same name twice.
  const stepsByUserId = new Map();
  workflowSteps.forEach((step) => {
    const stepUserId = step.userId?._id || step.userId;
    if (!stepsByUserId.has(stepUserId)) {
      stepsByUserId.set(stepUserId, []);
    }
    stepsByUserId.get(stepUserId).push(step);
  });

  stepsByUserId.forEach((steps, stepUserId) => {
    // Which of this person's steps best represents their standing right
    // now: the current step if one of their steps IS it, otherwise their
    // most recently (re)created step (highest stepOrder) — e.g. the fresh
    // 'pending' step a resubmit just gave them, rather than their older,
    // now-terminal one.
    const ownCurrentStep = currentStep && steps.some((step) => step._id === currentStep._id) ? currentStep : null;
    const representativeStep =
      ownCurrentStep || steps.reduce((latest, step) => (step.stepOrder > latest.stepOrder ? step : latest));
    const isCurrent = Boolean(ownCurrentStep);
    const statusKey = isCurrent ? 'current' : representativeStep.status;
    rows.push({
      rowKey: stepUserId,
      userId: stepUserId,
      name: representativeStep.userId?.name || userMeta(stepUserId)?.name || 'Unknown',
      department: departmentName(stepUserId),
      statusKey,
      statusLabel: REAL_STATUS_LABEL[statusKey] || representativeStep.status,
      // Kept in sync across all of a person's steps by the backend
      // (setMyRoleLabel updates every step the requester holds), so any of
      // their steps already carries the same value.
      roleLabel: representativeStep.roleLabel || null,
      editable: stepUserId === currentUserId,
      removable: Boolean(canManage) && representativeStep.status === 'pending' && !isCurrent,
    });
  });

  const addCandidates = directory.users.filter((user) => !(memo.workflowParticipants || []).includes(user._id));

  const openAdd = () => {
    setAddOpen(true);
    setAddError('');
  };
  const closeAdd = () => {
    setAddOpen(false);
    setAddUserId('');
    setAddReason('');
    setAddError('');
  };

  const submitAdd = async (event) => {
    event.preventDefault();
    if (!addUserId) {
      setAddError('Select a user to add');
      return;
    }
    setAddBusy(true);
    setAddError('');
    try {
      await addWorkflowParticipant(memo._id, addUserId, addReason);
      toast.success('Participant added');
      closeAdd();
      await onActionComplete();
    } catch (actionError) {
      const message = actionError.response?.data?.message || 'Failed to add participant';
      setAddError(message);
      toast.error(message);
    } finally {
      setAddBusy(false);
    }
  };

  const startRemove = (userId) => {
    setRemovingId(userId);
    setRemoveReason('');
    setRemoveError('');
  };
  const cancelRemove = () => {
    setRemovingId(null);
    setRemoveReason('');
    setRemoveError('');
  };
  const confirmRemove = async (userId) => {
    if (!removeReason.trim()) {
      setRemoveError('Reason is required');
      return;
    }
    setRemoveBusy(true);
    setRemoveError('');
    try {
      await removeWorkflowParticipant(memo._id, userId, removeReason);
      toast.success('Participant removed');
      cancelRemove();
      await onActionComplete();
    } catch (actionError) {
      const message = actionError.response?.data?.message || 'Failed to remove participant';
      setRemoveError(message);
      toast.error(message);
    } finally {
      setRemoveBusy(false);
    }
  };

  const startEditRole = (row) => {
    setEditingUserId(row.userId);
    setRoleDraft(row.roleLabel || '');
    setRoleError('');
  };
  const cancelEditRole = () => {
    setEditingUserId(null);
    setRoleDraft('');
    setRoleError('');
  };
  const submitRole = async () => {
    if (roleDraft.length > 100) {
      setRoleError('Must be 100 characters or fewer');
      return;
    }
    setRoleBusy(true);
    setRoleError('');
    try {
      await setMyRoleLabel(memo._id, roleDraft);
      toast.success('Role label updated');
      setEditingUserId(null);
      await onActionComplete();
    } catch (actionError) {
      const message = actionError.response?.data?.message || 'Failed to update role label';
      setRoleError(message);
      toast.error(message);
    } finally {
      setRoleBusy(false);
    }
  };

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5 sm:px-6">
        <p className="text-sm font-semibold text-stone-800">Participants</p>
        {canManage && (
          <button
            type="button"
            onClick={() => (addOpen ? closeAdd() : openAdd())}
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-blue-700 transition-colors hover:text-blue-900"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {addOpen && (
        <form onSubmit={submitAdd} className="animate-fade-in-up space-y-2 border-b border-stone-100 bg-stone-50/60 px-5 py-3.5 sm:px-6">
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <Select value={addUserId} onChange={(event) => setAddUserId(event.target.value)} className="!py-1.5 text-sm">
            <option value="">Select a user...</option>
            {addCandidates.map((user) => (
              <option key={user._id} value={user._id}>
                {user.name} ({user.email})
              </option>
            ))}
          </Select>
          <Input
            required
            placeholder="Reason (required)"
            value={addReason}
            onChange={(event) => setAddReason(event.target.value)}
            className="!py-1.5 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={closeAdd}>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" size="sm" disabled={addBusy}>
              Add participant
            </Button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-stone-100">
        {rows.map((row) => (
          <ParticipantRow
            key={row.rowKey}
            row={row}
            onEditRole={startEditRole}
            onStartRemove={startRemove}
            onCancelRemove={cancelRemove}
            onConfirmRemove={confirmRemove}
            removeState={{
              userId: removingId,
              reason: removeReason,
              busy: removeBusy,
              error: removeError,
              onReasonChange: setRemoveReason,
            }}
            roleState={{
              editing: editingUserId === row.userId,
              draft: roleDraft,
              busy: roleBusy,
              error: roleError,
            }}
            onRoleChange={setRoleDraft}
            onRoleSubmit={submitRole}
            onRoleCancel={cancelEditRole}
          />
        ))}
        {rows.length === 0 && <li className="px-5 py-6 text-center text-sm text-stone-500 sm:px-6">No participants yet.</li>}
      </ul>
    </Card>
  );
}

export default ParticipantWorkspace;
