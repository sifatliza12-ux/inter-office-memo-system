import api from './api';

export const listDepartments = (params = {}) => api.get('/departments', { params });

export const createDepartment = (data) => api.post('/departments', data);

export const updateDepartment = (id, data) => api.patch(`/departments/${id}`, data);

export const updateDepartmentStatus = (id, status) => api.patch(`/departments/${id}/status`, { status });
