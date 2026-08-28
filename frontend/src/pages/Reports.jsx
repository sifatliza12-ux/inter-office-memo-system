import { useCallback, useEffect, useState } from 'react';

import { getReports } from '../services/reports';
import { getDirectory } from '../services/directory';
import NavBar from '../components/NavBar.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Select from '../components/ui/Select.jsx';
import Input from '../components/ui/Input.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

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

const STAT_CARDS = [
  { key: 'urgentMemoCount', label: 'Urgent Memos', accent: 'text-red-600' },
  { key: 'pendingApprovalsCount', label: 'Pending Approvals', accent: 'text-amber-600' },
  { key: 'rejectedCount', label: 'Rejected', accent: 'text-stone-800' },
  { key: 'changeRequestCount', label: 'Change Requests', accent: 'text-stone-800' },
];

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
    <div className="min-h-screen bg-stone-50 pt-16 lg:pl-60">
      <NavBar />
      <PageContainer title="Reports">
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="report-date-from">
                From
              </label>
              <Input
                id="report-date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
              />
            </div>

            <div className="w-36">
              <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="report-date-to">
                To
              </label>
              <Input
                id="report-date-to"
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
              />
            </div>

            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="report-department">
                Department
              </label>
              <Select
                id="report-department"
                value={filters.department}
                onChange={(event) => setFilters({ ...filters, department: event.target.value })}
              >
                <option value="">All</option>
                {departments.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="report-category">
                Category
              </label>
              <Select
                id="report-category"
                value={filters.category}
                onChange={(event) => setFilters({ ...filters, category: event.target.value })}
              >
                <option value="">All</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>

            <Button type="submit" variant="primary">
              Apply
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </form>
        </Card>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {loading && <LoadingSpinner label="Loading..." className="justify-start" />}

        {report && (
          <div className="animate-fade-in-up space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {STAT_CARDS.map(({ key, label, accent }) => (
                <Card key={key} className="text-center">
                  <p className="text-xs text-stone-500">{label}</p>
                  <p className={`mt-1 text-2xl font-semibold ${accent}`}>{report[key]}</p>
                </Card>
              ))}
              <Card className="text-center">
                <p className="text-xs text-stone-500">Avg. Completion Time</p>
                <p className="mt-1 text-2xl font-semibold text-stone-800">
                  {formatHours(report.averageWorkflowCompletionTime)}
                </p>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <h2 className="text-sm font-semibold text-stone-800">Memos by Status</h2>
                <table className="mt-3 w-full text-left text-sm">
                  <tbody>
                    {Object.entries(report.memosByStatus).map(([status, count]) => (
                      <tr key={status} className="border-b border-stone-100 last:border-0">
                        <td className="py-1.5 text-stone-600">{STATUS_LABELS[status] || status}</td>
                        <td className="py-1.5 text-right font-medium text-stone-800">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card>
                <h2 className="text-sm font-semibold text-stone-800">Memos by Category</h2>
                <table className="mt-3 w-full text-left text-sm">
                  <tbody>
                    {Object.entries(report.memosByCategory).map(([category, count]) => (
                      <tr key={category} className="border-b border-stone-100 last:border-0">
                        <td className="py-1.5 text-stone-600">{category}</td>
                        <td className="py-1.5 text-right font-medium text-stone-800">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <Card>
                <h2 className="text-sm font-semibold text-stone-800">Memos by Department</h2>
                {report.memosByDepartment.length === 0 ? (
                  <EmptyState title="No memos found" />
                ) : (
                  <table className="mt-3 w-full text-left text-sm">
                    <tbody>
                      {report.memosByDepartment.map((row) => (
                        <tr key={row.department} className="border-b border-stone-100 last:border-0">
                          <td className="py-1.5 text-stone-600">{row.department}</td>
                          <td className="py-1.5 text-right font-medium text-stone-800">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          </div>
        )}
      </PageContainer>
    </div>
  );
}

export default Reports;
