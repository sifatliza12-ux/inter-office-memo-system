import api from './api';

export const listMyMemos = (params = {}) => api.get('/memos/mine', { params });

export const listInbox = (params = {}) => api.get('/memos/inbox', { params });

export const getMemo = (id) => api.get(`/memos/${id}`);

export const createMemo = (data) => api.post('/memos', data);

export const updateMemo = (id, data) => api.patch(`/memos/${id}`, data);

export const deleteMemo = (id) => api.delete(`/memos/${id}`);

export const submitMemo = (id) => api.post(`/memos/${id}/submit`);
