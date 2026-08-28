import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead } from '../services/notifications';
import LoadingSpinner from './ui/LoadingSpinner.jsx';

const POLL_INTERVAL_MS = 30000;

function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { data } = await getUnreadCount();
      setUnreadCount(data.count);
    } catch {
      // Silently ignore — the badge just won't update this cycle.
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openPanel = async () => {
    setOpen((prev) => !prev);
    if (!open) {
      setLoading(true);
      setError('');
      try {
        const { data } = await getNotifications();
        setNotifications(data.notifications);
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleNotificationClick = async (notification) => {
    setOpen(false);
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification._id);
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        // Navigate anyway — the read-state update is best-effort here.
      }
    }
    if (notification.memoId) {
      navigate(`/memos/${notification.memoId}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Leave state as-is; the user can retry.
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={openPanel}
        className="relative rounded-md p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-blue-700"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-5a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-1.6 1.6A1 1 0 0 0 4.1 19h15.8a1 1 0 0 0 .7-1.4L19 16Z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-tangerine-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 animate-fade-in-up rounded-xl border border-stone-200 bg-white shadow-card-hover">
          <div className="flex items-center justify-between border-b border-stone-100 px-3.5 py-2.5">
            <p className="text-sm font-semibold text-stone-800">Notifications</p>
            <button onClick={handleMarkAllRead} className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline">
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {error && <p className="p-3 text-sm text-red-600">{error}</p>}
            {loading ? (
              <div className="p-4">
                <LoadingSpinner size="sm" label="Loading..." />
              </div>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-sm text-stone-400">No notifications.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`block w-full border-b border-stone-50 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-stone-50 ${
                    notification.isRead ? '' : 'bg-blue-50/60'
                  }`}
                >
                  <p className="font-medium text-stone-800">{notification.title}</p>
                  <p className="mt-0.5 text-xs text-stone-600">{notification.message}</p>
                  <p className="mt-0.5 text-[11px] text-stone-400">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
