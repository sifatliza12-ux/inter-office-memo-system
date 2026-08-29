import { useCallback, useEffect, useState } from 'react';

import { getWorkflowActions } from '../services/workflow';

// Deliberately minimal scaffolding for Stage 13b — a plain list, no styling
// investment, since Stage 13d combines this with WorkflowTimeline into one
// proper unified view. Kept visually distinct/separately-labeled so it's
// obviously not the final UI.
function ActionLogSection({ memoId }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getWorkflowActions(memoId);
      setActions(data.actions);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load action log');
    } finally {
      setLoading(false);
    }
  }, [memoId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  return (
    <div>
      <p className="text-sm font-medium text-stone-700">Action Log (new format)</p>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <ul className="mt-2 space-y-1 text-sm text-stone-600">
        {loading ? (
          <li className="text-stone-500">Loading...</li>
        ) : actions.length === 0 ? (
          <li className="text-stone-500">No actions recorded yet.</li>
        ) : (
          actions.map((entry) => (
            <li key={entry._id}>
              [v{entry.versionNumber}] {entry.actor?.name || 'Unknown'} — {entry.action}
              {entry.recipient?.name ? ` -> ${entry.recipient.name}` : ''}
              {entry.comment ? `: "${entry.comment}"` : ''} ({new Date(entry.createdAt).toLocaleString()})
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default ActionLogSection;
