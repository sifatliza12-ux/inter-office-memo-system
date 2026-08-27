import api from './api';

export const getComments = (memoId) => api.get(`/memos/${memoId}/comments`);

export const createComment = (memoId, text) => api.post(`/memos/${memoId}/comments`, { text });
