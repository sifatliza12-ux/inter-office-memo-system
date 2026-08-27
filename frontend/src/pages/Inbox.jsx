import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listInbox } from '../services/memos';
import NavBar from '../components/NavBar.jsx';

const STATUSES = ['submitted', 'changes_requested'];
const CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

// ageMs is time since currentStepSince (memo.service.js's listInbox) —
// exact, not approximate. Still formatted coarsely (minutes/hours/days)
// since sub-minute precision isn't useful in this list.
const formatAge = (ageMs) => {
  if (typeof ageMs !== 'number' || Number.isNaN(ageMs) || ageMs < 0) {
    return '—';
  }
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

function Inbox() {
  const [memos, setMemos] = useState([]);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.priority) params.priority = filters.priority;

      const { data } = await listInbox(params);
      setMemos(data.memos);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-800">Inbox</h1>

        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600" htmlFor="inbox-status-filter">
              Status
            </label>
            <select
              id="inbox-status-filter"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">All</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600" htmlFor="inbox-category-filter">
              Category
            </label>
            <select
              id="inbox-category-filter"
              value={filters.category}
              onChange={(event) => setFilters({ ...filters, category: event.target.value })}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">All</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600" htmlFor="inbox-priority-filter">
              Priority
            </label>
            <select
              id="inbox-priority-filter"
              value={filters.priority}
              onChange={(event) => setFilters({ ...filters, priority: event.target.value })}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">All</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="p-3">Reference #</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Author</th>
                <th className="p-3">Department</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Submitted</th>
                <th className="p-3">Age</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="p-4 text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : memos.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-4 text-gray-500">
                    Nothing is waiting on you right now.
                  </td>
                </tr>
              ) : (
                memos.map((memo) => (
                  <tr key={memo._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3">
                      <Link to={`/memos/${memo._id}`} className="text-blue-600 hover:underline">
                        {memo.referenceNumber}
                      </Link>
                    </td>
                    <td className="p-3">{memo.subject}</td>
                    <td className="p-3">{memo.authorId?.name || '—'}</td>
                    <td className="p-3">{memo.departmentId?.name || '—'}</td>
                    <td className="p-3">{memo.priority}</td>
                    <td className="p-3">{memo.status}</td>
                    <td className="p-3">{memo.submittedAt ? new Date(memo.submittedAt).toLocaleDateString() : '—'}</td>
                    <td className="p-3">{formatAge(memo.ageMs)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Inbox;
