import { useEffect, useState } from 'react';

import { getOrganizationDashboard } from '../services/dashboard';

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  rejected: 'Rejected',
};

function OrganizationStatsSection() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getOrganizationDashboard()
      .then(({ data }) => {
        if (active) setStats(data);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.response?.data?.message || 'Failed to load organization stats');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-gray-800">Organization Overview</h2>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-2 text-sm text-gray-500">Loading...</p>}

      {stats && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded border border-gray-100 p-3 text-center">
              <p className="text-xs text-gray-500">Total Users</p>
              <p className="text-xl font-semibold text-gray-800">{stats.totalUsers}</p>
            </div>
            <div className="rounded border border-gray-100 p-3 text-center">
              <p className="text-xs text-gray-500">Active Users</p>
              <p className="text-xl font-semibold text-gray-800">{stats.activeUsers}</p>
            </div>
            <div className="rounded border border-gray-100 p-3 text-center">
              <p className="text-xs text-gray-500">Departments</p>
              <p className="text-xl font-semibold text-gray-800">{stats.totalDepartments}</p>
            </div>
            <div className="rounded border border-gray-100 p-3 text-center">
              <p className="text-xs text-gray-500">Total Memos</p>
              <p className="text-xl font-semibold text-gray-800">{stats.totalMemos}</p>
            </div>
            <div className="rounded border border-gray-100 p-3 text-center">
              <p className="text-xs text-gray-500">Pending Workflows</p>
              <p className="text-xl font-semibold text-gray-800">{stats.pendingWorkflows}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700">Memos by status</p>
            <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(stats.memosByStatus).map(([status, count]) => (
                <div key={status} className="rounded border border-gray-100 p-3 text-center">
                  <dt className="text-xs text-gray-500">{STATUS_LABELS[status] || status}</dt>
                  <dd className="text-lg font-semibold text-gray-800">{count}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </section>
  );
}

export default OrganizationStatsSection;
