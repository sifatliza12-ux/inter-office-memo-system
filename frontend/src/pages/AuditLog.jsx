import { useCallback, useEffect, useState } from 'react';

import { getAuditLogs } from '../services/auditLogs';
import { getDirectory } from '../services/directory';
import NavBar from '../components/NavBar.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Select from '../components/ui/Select.jsx';
import Input from '../components/ui/Input.jsx';
import { Table, THead, Th, Tr, Td } from '../components/ui/Table.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

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
  'WORKFLOW_REDIRECTED',
  'WORKFLOW_DECLINED_REDIRECTED',
  'WORKFLOW_PARTICIPANT_REMOVED',
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
    <div className="min-h-screen bg-stone-50 pt-16 lg:pl-60">
      <NavBar />
      <PageContainer title="Audit Log">
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="audit-event-type">
                Event type
              </label>
              <Select
                id="audit-event-type"
                value={filters.eventType}
                onChange={(event) => setFilters({ ...filters, eventType: event.target.value })}
              >
                <option value="">All</option>
                {EVENT_TYPES.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {eventType}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="audit-user">
                Actor
              </label>
              <Select
                id="audit-user"
                value={filters.userId}
                onChange={(event) => setFilters({ ...filters, userId: event.target.value })}
              >
                <option value="">All</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-36">
              <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="audit-date-from">
                From
              </label>
              <Input
                id="audit-date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}
              />
            </div>

            <div className="w-36">
              <label className="mb-1 block text-xs font-medium text-stone-500" htmlFor="audit-date-to">
                To
              </label>
              <Input
                id="audit-date-to"
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}
              />
            </div>

            <Button type="submit" variant="primary">
              Filter
            </Button>
          </form>
        </Card>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Table>
          <THead>
            <Th>Timestamp</Th>
            <Th>Actor</Th>
            <Th>Event</Th>
            <Th>Description</Th>
          </THead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="px-4 py-6">
                  <LoadingSpinner label="Loading..." />
                </td>
              </tr>
            ) : results.auditLogs.length === 0 ? (
              <tr>
                <td colSpan="4">
                  <EmptyState title="No audit log entries found" />
                </td>
              </tr>
            ) : (
              results.auditLogs.map((entry) => (
                <Tr key={entry._id}>
                  <Td className="whitespace-nowrap text-stone-500">{new Date(entry.createdAt).toLocaleString()}</Td>
                  <Td>{entry.userId?.name || 'Unknown user'}</Td>
                  <Td className="whitespace-nowrap">
                    <Badge color="plum" className="font-mono">
                      {entry.eventType}
                    </Badge>
                  </Td>
                  <Td>{entry.description}</Td>
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

export default AuditLog;
