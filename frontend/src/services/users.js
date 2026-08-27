import api from './api';

export const listUsers = (params = {}) => api.get('/users', { params });

export const createUser = (data) => api.post('/users', data);

export const updateUser = (id, data) => api.patch(`/users/${id}`, data);

export const updateUserStatus = (id, status) => api.patch(`/users/${id}/status`, { status });
