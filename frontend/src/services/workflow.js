import api from './api';

export const getWorkflow = (memoId) => api.get(`/memos/${memoId}/workflow`);

export const approveMemo = (memoId, comment) => api.post(`/memos/${memoId}/approve`, { comment });

export const rejectMemo = (memoId, comment) => api.post(`/memos/${memoId}/reject`, { comment });

export const requestChanges = (memoId, comment) => api.post(`/memos/${memoId}/request-changes`, { comment });

export const resubmitMemo = (memoId) => api.post(`/memos/${memoId}/resubmit`);

export const addWorkflowParticipant = (memoId, userId, reason) =>
  api.post(`/memos/${memoId}/workflow/add-participant`, { userId, reason });
