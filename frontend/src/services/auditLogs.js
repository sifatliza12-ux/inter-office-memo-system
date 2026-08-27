import api from './api';

export const getAuditLogs = (params = {}) => api.get('/audit-logs', { params });
