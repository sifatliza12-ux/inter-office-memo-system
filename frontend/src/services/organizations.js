import api from './api';

export const createOrganization = (data) => api.post('/organizations', data);
