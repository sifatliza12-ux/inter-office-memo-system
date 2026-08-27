import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listMyMemos } from '../services/memos';

const STATUSES = ['draft', 'submitted'];
const CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

function MyMemos() {
  const [memos, setMemos] = useState([]);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMemos = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.priority) params.priority = filters.priority;

      const { data } = await listMyMemos(params);
      setMemos(data.memos);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load memos');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMemos();
  }, [fetchMemos]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">My Memos</h1>
            <Link to="/" className="text-sm text-blue-600 hover:underline">
              Back to home
            </Link>
          </div>
          <Link to="/memos/new" className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
            New Memo
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-4 shadow">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600" htmlFor="memo-status-filter">
              Status
            </label>
            <select
              id="memo-status-filter"
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
            <label className="text-sm text-gray-600" htmlFor="memo-category-filter">
              Category
            </label>
            <select
              id="memo-category-filter"
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
            <label className="text-sm text-gray-600" htmlFor="memo-priority-filter">
              Priority
            </label>
            <select
              id="memo-priority-filter"
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
                <th className="p-3">Status</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-4 text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : memos.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-4 text-gray-500">
                    No memos found.
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
                    <td className="p-3">{memo.status}</td>
                    <td className="p-3">{memo.priority}</td>
                    <td className="p-3">{new Date(memo.updatedAt).toLocaleString()}</td>
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

export default MyMemos;
