import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { searchMemos } from '../services/search';
import { getDirectory } from '../services/directory';
import NavBar from '../components/NavBar.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import { Table, THead, Th, Tr, Td } from '../components/ui/Table.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

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
    <div className="min-h-screen bg-stone-50 pt-16 lg:pl-60">
      <NavBar />
      <PageContainer title="Search Memos">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="search-q">
                Search
              </label>
              <Input
                id="search-q"
                value={filters.q}
                onChange={(event) => setFilters({ ...filters, q: event.target.value })}
                placeholder="Subject, body, or reference number"
              />
            </div>

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
          </form>
        </Card>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Table>
          <THead>
            <Th>Reference #</Th>
            <Th>Subject</Th>
            <Th>Status</Th>
            <Th>Priority</Th>
          </THead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="px-4 py-6">
                  <LoadingSpinner label="Searching..." />
                </td>
              </tr>
            ) : results.memos.length === 0 ? (
              <tr>
                <td colSpan="4">
                  <EmptyState title="No memos found" />
                </td>
              </tr>
            ) : (
              results.memos.map((memo) => (
                <Tr key={memo._id}>
                  <Td className="font-mono text-xs">
                    <Link to={`/memos/${memo._id}`} className="font-medium text-plum-700 hover:underline">
                      {memo.referenceNumber}
                    </Link>
                  </Td>
                  <Td>{memo.subject}</Td>
                  <Td>
                    <StatusBadge status={memo.status} />
                  </Td>
                  <Td className="capitalize">{memo.priority}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>

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
      </PageContainer>
    </div>
  );
}

export default Search;
