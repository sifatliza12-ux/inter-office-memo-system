import { useCallback, useEffect, useState } from 'react';

import { getAuditLogs } from '../services/auditLogs';
import { getDirectory } from '../services/directory';
import NavBar from '../components/NavBar.jsx';

const EVENT_TYPES = [
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_CREATED',
  'USER_ACTIVATED',
  'USER_DEACTIVATED',
  'MEMO_CREATED',
  'MEMO_MODIFIED',
  'MEMO_SUBMITTED',
  'WORKFLOW_ASSIGNED',
  'WORKFLOW_APPROVED',
  'WORKFLOW_REJECTED',
  'CHANGE_REQUESTED',
  'MEMO_RESUBMITTED',
  'WORKFLOW_PARTICIPANT_ADDED',
  'WORKFLOW_COMPLETED',
  'COMMENT_ADDED',
  'ATTACHMENT_UPLOADED',
  'ATTACHMENT_DELETED',
];
const PAGE_SIZE = 20;

const emptyFilters = { eventType: '', userId: '', dateFrom: '', dateTo: '' };

function AuditLog() {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState({ auditLogs: [], total: 0, page: 1, limit: PAGE_SIZE });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDirectory()
      .then(({ data }) => setUsers(data.users))
      .catch(() => setUsers([]));
  }, []);

  const runQuery = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const { data } = await getAuditLogs(params);
      setResults(data);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    runQuery();
  }, [runQuery]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const totalPages = Math.max(1, Math.ceil(results.total / (results.limit || PAGE_SIZE)));

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-800">Audit Log</h1>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
          <div>
            <label className="block text-xs text-gray-600" htmlFor="audit-event-type">
              Event type
            </label>
            <select
              id="audit-event-type"
              value={filters.eventType}
              onChange={(event) => setFilters({ ...filters, eventType: event.target.value })}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              {EVENT_TYPES.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {eventType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600" htmlFor="audit-user">
              Actor
            </label>
            <select
              id="audit-user"
              value={filters.userId}
              onChange={(event) => setFilters({ ...filters, userId: event.target.value })}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600" htmlFor="audit-date-from">
              From
            </label>
            <input
              id="audit-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600" htmlFor="audit-date-to">
              To
            </label>
            <input
              id="audit-date-to"
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Filter
          </button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Event</th>
                <th className="p-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-4 text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : results.auditLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-4 text-gray-500">
                    No audit log entries found.
                  </td>
                </tr>
              ) : (
                results.auditLogs.map((entry) => (
                  <tr key={entry._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="whitespace-nowrap p-3 text-gray-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">{entry.userId?.name || 'Unknown user'}</td>
                    <td className="whitespace-nowrap p-3 font-mono text-xs text-gray-600">{entry.eventType}</td>
                    <td className="p-3">{entry.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {results.total > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {results.page} of {totalPages} ({results.total} total)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded border border-gray-300 px-3 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLog;
