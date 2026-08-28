import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { searchMemos } from '../services/search';
import { getDirectory } from '../services/directory';
import AppShell from '../components/AppShell.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import { SearchIcon } from '../components/icons.jsx';

const STATUSES = ['draft', 'submitted', 'changes_requested', 'approved', 'rejected'];
const CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const PAGE_SIZE = 20;

const emptyFilters = { q: '', status: '', category: '', priority: '', department: '', dateFrom: '', dateTo: '' };

// Purely presentational grouping — the API already returns results sorted
// newest-first; this just clusters that same list under department headers
// rather than introducing a second query or changing sort order.
const groupByDepartment = (memos) => {
  const groups = new Map();
  memos.forEach((memo) => {
    const key = memo.departmentId?.name || 'Unassigned';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(memo);
  });
  return Array.from(groups.entries());
};

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
  const grouped = useMemo(() => groupByDepartment(results.memos), [results.memos]);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl animate-fade-in-up space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Search Memos</h1>
          <p className="mt-1 text-sm text-stone-500">Find any memo you authored or participated in, across the organization.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <Input
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              placeholder="Search memo title, ID, department..."
              className="!py-3 !pl-11 !text-base shadow-card"
            />
          </div>

          <Card className="mt-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Filters</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="search-status">
                  Status
                </label>
                <Select
                  id="search-status"
                  value={filters.status}
                  onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                >
                  <option value="">All</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-44">
                <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="search-department">
                  Department
                </label>
                <Select
                  id="search-department"
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

              <div className="w-44">
                <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="search-category">
                  Category
                </label>
                <Select
                  id="search-category"
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

              <div className="w-36">
                <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="search-priority">
                  Priority
                </label>
                <Select
                  id="search-priority"
                  value={filters.priority}
                  onChange={(event) => setFilters({ ...filters, priority: event.target.value })}
                >
                  <option value="">All</option>
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-36">
                <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="search-date-from">
                  From
                </label>
                <Input
                  id="search-date-from"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
                />
              </div>

              <div className="w-36">
                <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="search-date-to">
                  To
                </label>
                <Input
                  id="search-date-to"
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
                />
              </div>

              <Button type="submit" variant="primary">
                Search
              </Button>
            </div>
          </Card>
        </form>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {loading ? (
          <LoadingSpinner label="Searching..." className="justify-start py-8" />
        ) : results.memos.length === 0 ? (
          <Card>
            <EmptyState title="No memos found" message="Try adjusting your filters or search terms." />
          </Card>
        ) : (
          <div className="space-y-6">
            <p className="text-sm font-medium text-stone-500">
              {results.total} result{results.total === 1 ? '' : 's'}
            </p>

            {grouped.map(([departmentName, memos]) => (
              <div key={departmentName}>
                <p className="border-b border-stone-200 pb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                  {departmentName}
                </p>
                <ul className="divide-y divide-stone-100">
                  {memos.map((memo) => (
                    <li key={memo._id}>
                      <Link
                        to={`/memos/${memo._id}`}
                        className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-stone-100/60 -mx-2 px-2 rounded-md"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-stone-800">{memo.subject}</p>
                          <p className="mt-0.5 flex items-center gap-2 text-xs text-stone-400">
                            <span className="font-mono">{memo.referenceNumber}</span>
                            <span aria-hidden="true">&middot;</span>
                            <StatusBadge status={memo.status} />
                          </p>
                        </div>
                        <span className="shrink-0 text-sm capitalize text-stone-400">{memo.priority}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {results.total > 0 && (
              <div className="flex items-center justify-between text-sm text-stone-600">
                <span>
                  Page {results.page} of {totalPages} ({results.total} total)
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default Search;
