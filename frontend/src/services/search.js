import api from './api';

export const searchMemos = (params = {}) => api.get('/memos/search', { params });
