import api from './api';

export const getAttachments = (memoId) => api.get(`/memos/${memoId}/attachments`);

export const uploadAttachment = (memoId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/memos/${memoId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const deleteAttachment = (memoId, attachmentId) =>
  api.delete(`/memos/${memoId}/attachments/${attachmentId}`);

// Downloads are fetched as a blob (with the normal Authorization header)
// rather than a plain <a href>, since a bare link can't carry the bearer
// token this app authenticates with — then the browser save is triggered
// from the blob via a throwaway object URL.
export const downloadAttachment = async (memoId, attachmentId, filename) => {
  const response = await api.get(`/memos/${memoId}/attachments/${attachmentId}/download`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
