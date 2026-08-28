import api from './api';

export const getWorkflow = (memoId) => api.get(`/memos/${memoId}/workflow`);

export const approveMemo = (memoId, comment) => api.post(`/memos/${memoId}/approve`, { comment });

export const rejectMemo = (memoId, comment) => api.post(`/memos/${memoId}/reject`, { comment });

export const requestChanges = (memoId, comment) => api.post(`/memos/${memoId}/request-changes`, { comment });

export const resubmitMemo = (memoId) => api.post(`/memos/${memoId}/resubmit`);

export const addWorkflowParticipant = (memoId, userId, reason) =>
  api.post(`/memos/${memoId}/workflow/add-participant`, { userId, reason });

// Stage 13c: dynamic workflow actions, alongside the existing approve/
// reject/request-changes/add-participant above.
export const redirectMemo = (memoId, userId, comment) => api.post(`/memos/${memoId}/redirect`, { userId, comment });

export const declineRedirectMemo = (memoId, userId, comment) =>
  api.post(`/memos/${memoId}/decline-redirect`, { userId, comment });

export const removeWorkflowParticipant = (memoId, userId, reason) =>
  api.post(`/memos/${memoId}/workflow/remove-participant`, { userId, reason });

// Pre-Stage-3: self-only descriptive metadata on the caller's own
// WorkflowStep. Passing '' clears the label (the backend normalizes empty/
// whitespace-only to null) — never send undefined, which the backend would
// instead treat as "field omitted" (also clears, but let's always be explicit).
export const setMyRoleLabel = (memoId, roleLabel) => api.patch(`/memos/${memoId}/workflow/role`, { roleLabel });

// Stage 13b: the new general event-log endpoint, separate from
// getWorkflow above — scaffolding for Stage 13d's unified timeline.
export const getWorkflowActions = (memoId) => api.get(`/memos/${memoId}/actions`);
