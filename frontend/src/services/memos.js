import api from './api';

export const listMyMemos = (params = {}) => api.get('/memos/mine', { params });

export const listInbox = (params = {}) => api.get('/memos/inbox', { params });

export const getMemo = (id) => api.get(`/memos/${id}`);

export const createMemo = (data) => api.post('/memos', data);

export const updateMemo = (id, data) => api.patch(`/memos/${id}`, data);

export const deleteMemo = (id) => api.delete(`/memos/${id}`);

export const submitMemo = (id) => api.post(`/memos/${id}/submit`);

// Same authenticated-blob-download pattern as attachments.js's
// downloadAttachment — a plain <a href> can't carry the bearer token this
// app authenticates with, so the file is fetched through the normal axios
// instance and the browser save is triggered from the resulting blob.
export const exportMemoPdf = async (id, referenceNumber) => {
  const response = await api.get(`/memos/${id}/export/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${referenceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
