import { useCallback, useEffect, useState } from 'react';

import { getReports } from '../services/reports';
import { getDirectory } from '../services/directory';
import NavBar from '../components/NavBar.jsx';

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  rejected: 'Rejected',
};

const CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];

const emptyFilters = { dateFrom: '', dateTo: '', department: '', category: '' };

const formatHours = (hours) => {
  if (hours === null || hours === undefined) {
    return 'N/A';
  }
  return `${hours.toFixed(1)}h`;
};

function Reports() {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [report, setReport] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDirectory()
      .then(({ data }) => setDepartments(data.departments))
      .catch(() => setDepartments([]));
  }, []);

  const runQuery = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const { data } = await getReports(params);
      setReport(data);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    runQuery();
  }, [runQuery]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold text-gray-800">Reports</h1>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
          <div>
            <label className="block text-xs text-gray-600" htmlFor="report-date-from">
              From
            </label>
            <input
              id="report-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600" htmlFor="report-date-to">
              To
            </label>
            <input
              id="report-date-to"
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600" htmlFor="report-department">
              Department
            </label>
            <select
              id="report-department"
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
            <label className="block text-xs text-gray-600" htmlFor="report-category">
              Category
            </label>
            <select
              id="report-category"
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

          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Reset
          </button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-gray-500">Loading...</p>}

        {report && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div className="rounded-lg bg-white p-4 text-center shadow">
                <p className="text-xs text-gray-500">Urgent Memos</p>
                <p className="mt-1 text-2xl font-semibold text-red-600">{report.urgentMemoCount}</p>
              </div>
              <div className="rounded-lg bg-white p-4 text-center shadow">
                <p className="text-xs text-gray-500">Pending Approvals</p>
                <p className="mt-1 text-2xl font-semibold text-amber-600">{report.pendingApprovalsCount}</p>
              </div>
              <div className="rounded-lg bg-white p-4 text-center shadow">
                <p className="text-xs text-gray-500">Rejected</p>
                <p className="mt-1 text-2xl font-semibold text-gray-800">{report.rejectedCount}</p>
              </div>
              <div className="rounded-lg bg-white p-4 text-center shadow">
                <p className="text-xs text-gray-500">Change Requests</p>
                <p className="mt-1 text-2xl font-semibold text-gray-800">{report.changeRequestCount}</p>
              </div>
              <div className="rounded-lg bg-white p-4 text-center shadow">
                <p className="text-xs text-gray-500">Avg. Completion Time</p>
                <p className="mt-1 text-2xl font-semibold text-gray-800">
                  {formatHours(report.averageWorkflowCompletionTime)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-white p-4 shadow">
                <h2 className="text-sm font-semibold text-gray-800">Memos by Status</h2>
                <table className="mt-2 w-full text-left text-sm">
                  <tbody>
                    {Object.entries(report.memosByStatus).map(([status, count]) => (
                      <tr key={status} className="border-b border-gray-100 last:border-0">
                        <td className="py-1 text-gray-600">{STATUS_LABELS[status] || status}</td>
                        <td className="py-1 text-right font-medium text-gray-800">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg bg-white p-4 shadow">
                <h2 className="text-sm font-semibold text-gray-800">Memos by Category</h2>
                <table className="mt-2 w-full text-left text-sm">
                  <tbody>
                    {Object.entries(report.memosByCategory).map(([category, count]) => (
                      <tr key={category} className="border-b border-gray-100 last:border-0">
                        <td className="py-1 text-gray-600">{category}</td>
                        <td className="py-1 text-right font-medium text-gray-800">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg bg-white p-4 shadow">
                <h2 className="text-sm font-semibold text-gray-800">Memos by Department</h2>
                {report.memosByDepartment.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No memos found.</p>
                ) : (
                  <table className="mt-2 w-full text-left text-sm">
                    <tbody>
                      {report.memosByDepartment.map((row) => (
                        <tr key={row.department} className="border-b border-gray-100 last:border-0">
                          <td className="py-1 text-gray-600">{row.department}</td>
                          <td className="py-1 text-right font-medium text-gray-800">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Reports;
