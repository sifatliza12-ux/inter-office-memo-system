import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getDashboard } from '../services/dashboard';
import NavBar from '../components/NavBar.jsx';

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
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading && <p className="text-sm text-gray-500">Loading...</p>}

        {summary && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Link to="/inbox" className="block rounded-lg bg-white p-5 shadow hover:shadow-md">
                <p className="text-sm text-gray-500">Awaiting your action</p>
                <p className="mt-1 text-3xl font-semibold text-blue-600">{summary.inboxCount}</p>
                <p className="mt-1 text-sm text-blue-600">Go to Inbox &rarr;</p>
              </Link>

              <div className="rounded-lg bg-white p-5 shadow">
                <p className="text-sm text-gray-500">Memos authored by you</p>
                <p className="mt-1 text-3xl font-semibold text-gray-800">{summary.myMemosCount}</p>
              </div>
            </div>

            <div className="rounded-lg bg-white p-5 shadow">
              <h2 className="text-lg font-semibold text-gray-800">My memos by status</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {Object.entries(summary.myMemosByStatus).map(([status, count]) => (
                  <div key={status} className="rounded border border-gray-100 p-3 text-center">
                    <dt className="text-xs text-gray-500">{STATUS_LABELS[status] || status}</dt>
                    <dd className="text-xl font-semibold text-gray-800">{count}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-lg bg-white p-5 shadow">
              <h2 className="text-lg font-semibold text-gray-800">Recent activity</h2>
              {summary.recentActivity.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">No recent activity.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {summary.recentActivity.map((activity, index) => (
                    <li key={`${activity.memoId}-${index}`} className="py-2 text-sm">
                      <Link to={`/memos/${activity.memoId}`} className="text-blue-600 hover:underline">
                        {activity.referenceNumber}
                      </Link>{' '}
                      &mdash; {activity.actorName} {ACTION_LABELS[activity.action] || activity.action} &ldquo;
                      {activity.subject}&rdquo;
                      <span className="ml-2 text-gray-400">
                        {activity.date ? new Date(activity.date).toLocaleString() : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
