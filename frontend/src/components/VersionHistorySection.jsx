import { useCallback, useEffect, useState } from 'react';

import { getMemoVersions } from '../services/memos';
import LoadingSpinner from './ui/LoadingSpinner.jsx';

// Minimal/collapsed by design for Stage 13a — this is content VERSION
// history (what the memo contained at each submit/resubmit), distinct from
// the WorkflowTimeline's ACTION history (what people did). Gets properly
// styled and integrated with the timeline in Stage 13d.
function VersionHistorySection({ memoId }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getMemoVersions(memoId);
      setVersions(data.versions);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  }, [memoId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return (
    <div>
      <p className="text-sm font-medium text-stone-700">Version History</p>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <div className="mt-2 space-y-1.5">
        {loading ? (
          <LoadingSpinner size="sm" label="Loading versions..." className="justify-start" />
        ) : versions.length === 0 ? (
          <p className="text-sm text-stone-400">No version history yet.</p>
        ) : (
          versions.map((version) => (
            <details key={version._id} className="rounded-md border border-stone-200 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-stone-800">
                Version {version.versionNumber} &mdash; {new Date(version.createdAt).toLocaleString()}
                {version.createdBy?.name ? ` (${version.createdBy.name})` : ''}
              </summary>
              <div className="mt-2 space-y-2 border-t border-stone-100 pt-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-400">Subject</p>
                  <p className="text-stone-800">{version.subject}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-400">Body</p>
                  <p className="whitespace-pre-wrap text-stone-700">{version.body}</p>
                </div>
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}

export default VersionHistorySection;
