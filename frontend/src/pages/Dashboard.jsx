import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getDashboard } from '../services/dashboard';
import { useAuth } from '../context/AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import PageContainer from '../components/ui/PageContainer.jsx';
import Card from '../components/ui/Card.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

const STATUS_DOT = {
  draft: 'bg-stone-400',
  submitted: 'bg-blue-500',
  changes_requested: 'bg-amber-500',
  approved: 'bg-emerald-500',
  rejected: 'bg-red-500',
};

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  rejected: 'Rejected',
};

const ACTIVITY_DOT = {
  approved: 'bg-emerald-500',
  rejected: 'bg-red-500',
  changes_requested: 'bg-amber-500',
};

const ACTION_LABELS = {
  approved: 'approved',
  rejected: 'rejected',
  changes_requested: 'requested changes on',
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

function Dashboard() {
  const { user } = useAuth();
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

  const firstName = user?.name?.split(' ')[0] || user?.name;

  return (
    <AppShell>
      <PageContainer size="lg">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-stone-500">Here&rsquo;s the current state of your work.</p>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {loading && <LoadingSpinner label="Loading dashboard..." className="justify-start py-6" />}

        {summary && (
          <div className="animate-fade-in-up space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Total Memos</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-stone-900">{summary.myMemosCount}</p>
                <p className="mt-1 text-xs text-stone-400">Authored by you</p>
              </Card>

              <Link to="/inbox" className="block">
                <Card hoverable className="h-full border-terracotta-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-600">Pending Review</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-stone-900">{summary.inboxCount}</p>
                  <p className="mt-1 text-xs font-medium text-terracotta-600">
                    {summary.inboxCount === 0 ? 'Nothing waiting on you' : 'Review inbox →'}
                  </p>
                </Card>
              </Link>

              <Card>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Completed</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-stone-900">
                  {summary.myMemosByStatus.approved || 0}
                </p>
                <p className="mt-1 text-xs text-stone-400">Approved memos of yours</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card padded={false} className="lg:col-span-2">
                <h2 className="border-b border-stone-100 px-5 py-4 text-sm font-semibold text-stone-800 sm:px-6">
                  Memo Activity
                </h2>
                {summary.recentActivity.length === 0 ? (
                  <EmptyState title="No recent activity" message="Activity on your memos will appear here." />
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {summary.recentActivity.map((activity, index) => (
                      <li key={`${activity.memoId}-${index}`} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ACTIVITY_DOT[activity.action] || 'bg-stone-300'}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 text-sm">
                          <p className="text-stone-700">
                            <span className="font-medium text-stone-900">{activity.actorName}</span>{' '}
                            {ACTION_LABELS[activity.action] || activity.action}{' '}
                            <Link to={`/memos/${activity.memoId}`} className="font-medium text-plum-700 hover:underline">
                              {activity.subject}
                            </Link>
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-400">
                            <span className="font-mono">{activity.referenceNumber}</span>
                            <span>{activity.date ? new Date(activity.date).toLocaleString() : ''}</span>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card padded={false}>
                <h2 className="border-b border-stone-100 px-5 py-4 text-sm font-semibold text-stone-800 sm:px-6">
                  Status
                </h2>
                <ul className="divide-y divide-stone-100">
                  {Object.entries(summary.myMemosByStatus).map(([status, count]) => (
                    <li key={status} className="flex items-center justify-between px-5 py-3 text-sm sm:px-6">
                      <span className="flex items-center gap-2 text-stone-600">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status] || 'bg-stone-300'}`} aria-hidden="true" />
                        {STATUS_LABELS[status] || status}
                      </span>
                      <span className="font-semibold tabular-nums text-stone-800">{count}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}

export default Dashboard;
