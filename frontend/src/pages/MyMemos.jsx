import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listMyMemos } from '../services/memos';
import { getDirectory } from '../services/directory';
import AppShell from '../components/AppShell.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Select from '../components/ui/Select.jsx';
import { Table, THead, Th, Tr, Td } from '../components/ui/Table.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

// Every status a memo can actually reach — the backend filter already
// accepts any of these without restriction; this just fully exposes that
// existing capability as tabs instead of the previous two-value dropdown.
const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'changes_requested', label: 'Changes Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];
const CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const PRIORITY_ACCENT = {
  urgent: 'text-red-600',
  high: 'text-tangerine-600',
};

// currentApproverId is only ever populated while status === 'submitted' —
// reject/request-changes clear it (workflow.service.js), so
// changes_requested has no approver to point to; the ball is back in the
// author's own court at that point, not any of the workflow participants'.
const workflowDetail = (memo) => {
  switch (memo.status) {
    case 'submitted':
      return `Waiting on ${memo.currentApproverId?.name || 'unknown'}`;
    case 'changes_requested':
      return 'Waiting on you to revise & resubmit';
    case 'approved':
      return `Approved${memo.finalApproverId?.name ? ` by ${memo.finalApproverId.name}` : ''}`;
    case 'rejected':
      return 'Rejected';
    default:
      return null;
  }
};

function MyMemos() {
  const [searchParams] = useSearchParams();
  const [memos, setMemos] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    category: '',
    priority: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Keeps the status filter in sync with the URL — used by the sidebar's
  // Drafts link (/memos?status=draft) navigating in while this page is
  // already mounted, which changes the URL without remounting the component.
  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    setFilters((prev) => (prev.status === urlStatus ? prev : { ...prev, status: urlStatus }));
  }, [searchParams]);

  useEffect(() => {
    getDirectory()
      .then(({ data }) => setDepartments(data.departments))
      .catch(() => setDepartments([]));
  }, []);

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

  const departmentName = (id) => departments.find((department) => department._id === id)?.name;

  return (
    <AppShell>
      <PageContainer
        title="My Memos"
        actions={
          <Link to="/memos/new">
            <Button variant="primary">New Memo</Button>
          </Link>
        }
      >
      <div className="animate-fade-in-up space-y-6">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={filters.status === tab.value}
              onClick={() => setFilters({ ...filters, status: tab.value })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                filters.status === tab.value
                  ? 'bg-blue-800 text-white shadow-sm'
                  : 'bg-white text-stone-600 ring-1 ring-inset ring-stone-200 hover:bg-stone-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Card className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="memo-category-filter">
              Category
            </label>
            <Select
              id="memo-category-filter"
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
            <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="memo-priority-filter">
              Priority
            </label>
            <Select
              id="memo-priority-filter"
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
        </Card>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Table>
          <THead>
            <Th>Memo</Th>
            <Th>Department</Th>
            <Th>Status</Th>
            <Th>Participants</Th>
            <Th>Priority</Th>
            <Th>Updated</Th>
            <Th className="text-right">Actions</Th>
          </THead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="px-4 py-6">
                  <LoadingSpinner label="Loading..." />
                </td>
              </tr>
            ) : memos.length === 0 ? (
              <tr>
                <td colSpan="7">
                  <EmptyState title="No memos found" message="Memos you create will show up here." />
                </td>
              </tr>
            ) : (
              memos.map((memo) => (
                <Tr key={memo._id}>
                  <Td>
                    <Link to={`/memos/${memo._id}`} className="font-medium text-stone-800 hover:text-blue-700 hover:underline">
                      {memo.subject}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-stone-400">{memo.referenceNumber}</p>
                  </Td>
                  <Td className="text-stone-500">{departmentName(memo.departmentId) || '—'}</Td>
                  <Td>
                    <StatusBadge status={memo.status} />
                    {workflowDetail(memo) && <p className="mt-0.5 text-xs text-stone-400">{workflowDetail(memo)}</p>}
                  </Td>
                  <Td className="text-stone-500">
                    {memo.workflowParticipants?.length || 0}
                  </Td>
                  <Td className={`capitalize ${PRIORITY_ACCENT[memo.priority] || 'text-stone-600'}`}>{memo.priority}</Td>
                  <Td className="whitespace-nowrap text-stone-500">{new Date(memo.updatedAt).toLocaleDateString()}</Td>
                  <Td className="text-right">
                    {memo.status === 'draft' || memo.status === 'changes_requested' ? (
                      <Link to={`/memos/${memo._id}/edit`} className="text-sm font-medium text-blue-700 hover:underline">
                        Edit
                      </Link>
                    ) : (
                      <Link to={`/memos/${memo._id}`} className="text-sm font-medium text-blue-700 hover:underline">
                        View
                      </Link>
                    )}
                  </Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
      </PageContainer>
    </AppShell>
  );
}

export default MyMemos;
