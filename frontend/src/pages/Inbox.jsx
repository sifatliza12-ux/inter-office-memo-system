import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listInbox } from '../services/memos';
import NavBar from '../components/NavBar.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import Select from '../components/ui/Select.jsx';
import { Table, THead, Th, Tr, Td } from '../components/ui/Table.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

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
    <div className="min-h-screen bg-stone-50 pt-16 lg:pl-60">
      <NavBar />
      <PageContainer title="Inbox" subtitle="Memos waiting on your review or action">
        <Card className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="inbox-status-filter">
              Status
            </label>
            <Select
              id="inbox-status-filter"
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
            <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="inbox-category-filter">
              Category
            </label>
            <Select
              id="inbox-category-filter"
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
            <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="inbox-priority-filter">
              Priority
            </label>
            <Select
              id="inbox-priority-filter"
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
            <Th>Author</Th>
            <Th>Department</Th>
            <Th>Priority</Th>
            <Th>Status</Th>
            <Th>Submitted</Th>
            <Th>Age</Th>
          </THead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="px-4 py-6">
                  <LoadingSpinner label="Loading..." />
                </td>
              </tr>
            ) : memos.length === 0 ? (
              <tr>
                <td colSpan="8">
                  <EmptyState title="Nothing is waiting on you right now" />
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
                  <Td>{memo.authorId?.name || '—'}</Td>
                  <Td>{memo.departmentId?.name || '—'}</Td>
                  <Td className="capitalize">{memo.priority}</Td>
                  <Td>
                    <StatusBadge status={memo.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-stone-500">
                    {memo.submittedAt ? new Date(memo.submittedAt).toLocaleDateString() : '—'}
                  </Td>
                  <Td className="text-stone-500">{formatAge(memo.ageMs)}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </PageContainer>
    </div>
  );
}

export default Inbox;
