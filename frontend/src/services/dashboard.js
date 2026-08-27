import api from './api';

export const getDashboard = () => api.get('/dashboard');

export const getOrganizationDashboard = () => api.get('/dashboard/organization');
