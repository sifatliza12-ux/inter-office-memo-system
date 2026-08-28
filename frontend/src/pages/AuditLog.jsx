import { useCallback, useEffect, useState } from 'react';

import { getAuditLogs } from '../services/auditLogs';
import { getDirectory } from '../services/directory';
import { getStatusVisual } from '../components/statusVisuals.js';
import AppShell from '../components/AppShell.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Select from '../components/ui/Select.jsx';
import Input from '../components/ui/Input.jsx';
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

// Purely presentational — a color cue per event category so the timeline
// reads at a glance, without touching the backend-authored description
// text itself (that stays exactly as Stage 9 wrote it). Mapped events reuse
// the shared Stage 4a status-visual table (statusVisuals.js) so an
// approval, rejection, etc. reads the same blue/tangerine tone here as it
// does on the memo's own workflow timeline; anything not one of the 10
// mapped workflow states (account/comment/attachment events, plain
// creation/assignment) stays neutral stone.
const EVENT_VISUAL_KEY = {
  WORKFLOW_APPROVED: 'approved',
  WORKFLOW_COMPLETED: 'completed',
  WORKFLOW_REJECTED: 'rejected',
  CHANGE_REQUESTED: 'changes_requested',
  WORKFLOW_REDIRECTED: 'redirected',
  WORKFLOW_DECLINED_REDIRECTED: 'declined_redirected',
  MEMO_SUBMITTED: 'submitted',
  MEMO_RESUBMITTED: 'submitted',
  WORKFLOW_PARTICIPANT_ADDED: 'participant_added',
  WORKFLOW_PARTICIPANT_REMOVED: 'participant_removed',
};
const dotColorFor = (eventType) => {
  const key = EVENT_VISUAL_KEY[eventType];
  return key ? getStatusVisual(key).dot : 'bg-stone-400';
};

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
    <AppShell>
      <PageContainer title="Activity" subtitle="A human-readable record of what happened, by whom, and when">
      <div className="animate-fade-in-up space-y-6">
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

        <Card padded={false}>
          {loading ? (
            <div className="px-6 py-10">
              <LoadingSpinner label="Loading..." />
            </div>
          ) : results.auditLogs.length === 0 ? (
            <EmptyState title="No activity found" message="Try adjusting your filters." />
          ) : (
            <ol className="space-y-0 px-5 py-5 sm:px-6">
              {results.auditLogs.map((entry, index) => (
                <li key={entry._id} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotColorFor(entry.eventType)}`} aria-hidden="true" />
                    {index !== results.auditLogs.length - 1 && <span className="mt-1 w-px flex-1 bg-stone-200" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-5">
                    <p className="text-sm">
                      <span className="font-medium text-stone-900">{entry.userId?.name || 'Unknown user'}</span>{' '}
                      <span className="text-stone-600">{entry.description}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-stone-400">
                      <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      <span aria-hidden="true">&middot;</span>
                      <span className="font-mono">{entry.eventType}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

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
      </PageContainer>
    </AppShell>
  );
}

export default AuditLog;
