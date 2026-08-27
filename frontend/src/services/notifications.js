import api from './api';

export const getNotifications = (params = {}) => api.get('/notifications', { params });

export const getUnreadCount = () => api.get('/notifications/unread-count');

export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);

export const markAllNotificationsRead = () => api.patch('/notifications/read-all');
