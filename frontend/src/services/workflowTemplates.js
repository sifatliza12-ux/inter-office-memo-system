import api from './api';

export const listWorkflowTemplates = (params = {}) => api.get('/workflow-templates', { params });

export const createWorkflowTemplate = (data) => api.post('/workflow-templates', data);

export const updateWorkflowTemplate = (id, data) => api.patch(`/workflow-templates/${id}`, data);

export const deactivateWorkflowTemplate = (id) => api.patch(`/workflow-templates/${id}/deactivate`);
