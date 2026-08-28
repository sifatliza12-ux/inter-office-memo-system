import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listMyMemos } from '../services/memos';
import NavBar from '../components/NavBar.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Select from '../components/ui/Select.jsx';
import { Table, THead, Th, Tr, Td } from '../components/ui/Table.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

const STATUSES = ['draft', 'submitted'];
const CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

// currentApproverId is only ever populated while status === 'submitted' —
// reject/request-changes clear it (workflow.service.js), so
// changes_requested has no approver to point to; the ball is back in the
// author's own court at that point, not any of the workflow participants'.
const workflowDetail = (memo) => {
  switch (memo.status) {
    case 'submitted':
      return `Waiting on: ${memo.currentApproverId?.name || 'unknown'}`;
    case 'changes_requested':
      return 'Waiting on: you (revise & resubmit)';
    case 'approved':
      return `Approved${memo.finalApproverId?.name ? ` by ${memo.finalApproverId.name}` : ''}`;
    case 'rejected':
      return 'Rejected';
    default:
      return null;
  }
};

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
    <div className="min-h-screen bg-stone-50 pt-16 lg:pl-60">
      <NavBar />
      <PageContainer
        title="My Memos"
        actions={
          <Link to="/memos/new">
            <Button variant="primary">New Memo</Button>
          </Link>
        }
      >
        <Card className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="memo-status-filter">
              Status
            </label>
            <Select
              id="memo-status-filter"
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
            <Th>Reference #</Th>
            <Th>Subject</Th>
            <Th>Status</Th>
            <Th>Details</Th>
            <Th>Priority</Th>
            <Th>Last Updated</Th>
          </THead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="px-4 py-6">
                  <LoadingSpinner label="Loading..." />
                </td>
              </tr>
            ) : memos.length === 0 ? (
              <tr>
                <td colSpan="6">
                  <EmptyState title="No memos found" />
                </td>
              </tr>
            ) : (
              memos.map((memo) => (
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
                  <Td className="text-stone-500">{workflowDetail(memo)}</Td>
                  <Td className="capitalize">{memo.priority}</Td>
                  <Td className="whitespace-nowrap text-stone-500">{new Date(memo.updatedAt).toLocaleString()}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </PageContainer>
    </div>
  );
}

export default MyMemos;
