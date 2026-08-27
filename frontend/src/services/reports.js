import api from './api';

export const getReports = (params = {}) => api.get('/reports', { params });
