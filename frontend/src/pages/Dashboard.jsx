import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getDashboard } from '../services/dashboard';
import NavBar from '../components/NavBar.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  rejected: 'Rejected',
};

const ACTION_LABELS = {
  approved: 'approved',
  rejected: 'rejected',
  changes_requested: 'requested changes on',
};

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getDashboard()
      .then(({ data }) => {
        if (active) setSummary(data);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.response?.data?.message || 'Failed to load dashboard');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 pt-16 lg:pl-60">
      <NavBar />
      <PageContainer size="lg" title="Dashboard">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {loading && <LoadingSpinner label="Loading dashboard..." className="justify-start py-6" />}

        {summary && (
          <div className="animate-fade-in-up space-y-6">
            {/* Action-first: what needs attention comes before any statistics. */}
            <Card className="flex flex-col items-start gap-4 border-plum-200 bg-plum-800 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-plum-200">What needs your attention</p>
                <p className="mt-1 text-2xl font-semibold">
                  {summary.inboxCount === 0
                    ? 'Nothing is waiting on you right now'
                    : `${summary.inboxCount} memo${summary.inboxCount === 1 ? '' : 's'} awaiting your action`}
                </p>
              </div>
              <Link to="/inbox">
                <Button variant="primary">Review Inbox</Button>
              </Link>
            </Card>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <p className="text-sm text-stone-500">Memos authored by you</p>
                <p className="mt-1 text-3xl font-semibold text-stone-900">{summary.myMemosCount}</p>
              </Card>
              <Card>
                <p className="text-sm text-stone-500">My memos by status</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(summary.myMemosByStatus).map(([status, count]) => (
                    <div key={status} className="rounded-md border border-stone-100 bg-stone-50 p-2 text-center">
                      <dt className="text-[11px] text-stone-500">{STATUS_LABELS[status] || status}</dt>
                      <dd className="text-base font-semibold text-stone-800">{count}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>

            <Card padded={false}>
              <h2 className="border-b border-stone-100 px-5 py-4 text-sm font-semibold text-stone-800 sm:px-6">
                Recent activity
              </h2>
              {summary.recentActivity.length === 0 ? (
                <EmptyState title="No recent activity" />
              ) : (
                <ul className="divide-y divide-stone-100">
                  {summary.recentActivity.map((activity, index) => (
                    <li key={`${activity.memoId}-${index}`} className="px-5 py-3 text-sm sm:px-6">
                      <Link to={`/memos/${activity.memoId}`} className="font-mono text-plum-700 hover:underline">
                        {activity.referenceNumber}
                      </Link>{' '}
                      <span className="text-stone-600">
                        &mdash; {activity.actorName} {ACTION_LABELS[activity.action] || activity.action} &ldquo;
                        {activity.subject}&rdquo;
                      </span>
                      <span className="ml-2 text-stone-400">
                        {activity.date ? new Date(activity.date).toLocaleString() : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </PageContainer>
    </div>
  );
}

export default Dashboard;
