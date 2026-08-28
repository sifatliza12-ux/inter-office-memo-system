import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listInbox } from '../services/memos';
import AppShell from '../components/AppShell.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import Select from '../components/ui/Select.jsx';
import { Table, THead, Th, Tr, Td } from '../components/ui/Table.jsx';
import { StatusBadge } from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'changes_requested', label: 'Changes Requested' },
];
const CATEGORIES = ['Administrative', 'Financial', 'Procurement', 'HR', 'Academic', 'Technical', 'General'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const PRIORITY_ACCENT = {
  urgent: 'text-red-600',
  high: 'text-terracotta-600',
};

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
    <AppShell>
      <PageContainer title="Inbox" subtitle="Memos waiting on your review or action">
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
                  ? 'bg-plum-800 text-white shadow-sm'
                  : 'bg-white text-stone-600 ring-1 ring-inset ring-stone-200 hover:bg-stone-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Card className="flex flex-wrap items-end gap-3">
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
            <Th>Memo</Th>
            <Th>Author</Th>
            <Th>Department</Th>
            <Th>Status</Th>
            <Th>Participants</Th>
            <Th>Priority</Th>
            <Th>Waiting</Th>
            <Th className="text-right">Actions</Th>
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
                  <EmptyState title="Nothing is waiting on you right now" message="You're all caught up." />
                </td>
              </tr>
            ) : (
              memos.map((memo) => (
                <Tr key={memo._id}>
                  <Td>
                    <Link to={`/memos/${memo._id}`} className="font-medium text-stone-800 hover:text-plum-700 hover:underline">
                      {memo.subject}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-stone-400">{memo.referenceNumber}</p>
                  </Td>
                  <Td className="text-stone-500">{memo.authorId?.name || '—'}</Td>
                  <Td className="text-stone-500">{memo.departmentId?.name || '—'}</Td>
                  <Td>
                    <StatusBadge status={memo.status} />
                  </Td>
                  <Td className="text-stone-500">{memo.workflowParticipants?.length || 0}</Td>
                  <Td className={`capitalize ${PRIORITY_ACCENT[memo.priority] || 'text-stone-600'}`}>{memo.priority}</Td>
                  <Td>
                    <p className="font-medium text-stone-700">{formatAge(memo.ageMs)}</p>
                    <p className="text-xs text-stone-400">
                      {memo.submittedAt ? new Date(memo.submittedAt).toLocaleDateString() : '—'}
                    </p>
                  </Td>
                  <Td className="text-right">
                    <Link to={`/memos/${memo._id}`} className="text-sm font-medium text-plum-700 hover:underline">
                      Review →
                    </Link>
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

export default Inbox;
