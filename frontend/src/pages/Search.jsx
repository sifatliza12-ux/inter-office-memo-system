import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { searchMemos } from '../services/search';
import { getDirectory } from '../services/directory';
import NavBar from '../components/NavBar.jsx';

const STATUSES = ['draft', 'submitted', 'changes_requested', 'approved', 'rejected'];
const CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const PAGE_SIZE = 20;

const emptyFilters = { q: '', status: '', category: '', priority: '', department: '', dateFrom: '', dateTo: '' };

function Search() {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState({ memos: [], total: 0, page: 1, limit: PAGE_SIZE });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDirectory()
      .then(({ data }) => setDepartments(data.departments))
      .catch(() => setDepartments([]));
  }, []);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const { data } = await searchMemos(params);
      setResults(data);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

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
        <h1 className="text-2xl font-semibold text-gray-800">Search Memos</h1>

        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg bg-white p-4 shadow">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="search-q">
              Search
            </label>
            <input
              id="search-q"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              placeholder="Subject, body, or reference number"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-600" htmlFor="search-status">
                Status
              </label>
              <select
                id="search-status"
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600" htmlFor="search-category">
                Category
              </label>
              <select
                id="search-category"
                value={filters.category}
                onChange={(event) => setFilters({ ...filters, category: event.target.value })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600" htmlFor="search-priority">
                Priority
              </label>
              <select
                id="search-priority"
                value={filters.priority}
                onChange={(event) => setFilters({ ...filters, priority: event.target.value })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600" htmlFor="search-department">
                Department
              </label>
              <select
                id="search-department"
                value={filters.department}
                onChange={(event) => setFilters({ ...filters, department: event.target.value })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">All</option>
                {departments.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-600" htmlFor="search-date-from">
                From
              </label>
              <input
                id="search-date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600" htmlFor="search-date-to">
                To
              </label>
              <input
                id="search-date-to"
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
              Search
            </button>
          </div>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="p-3">Reference #</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Status</th>
                <th className="p-3">Priority</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-4 text-gray-500">
                    Searching...
                  </td>
                </tr>
              ) : results.memos.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-4 text-gray-500">
                    No memos found.
                  </td>
                </tr>
              ) : (
                results.memos.map((memo) => (
                  <tr key={memo._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3">
                      <Link to={`/memos/${memo._id}`} className="text-blue-600 hover:underline">
                        {memo.referenceNumber}
                      </Link>
                    </td>
                    <td className="p-3">{memo.subject}</td>
                    <td className="p-3">{memo.status}</td>
                    <td className="p-3">{memo.priority}</td>
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

export default Search;
