import { useState } from 'react';

import { addWorkflowParticipant } from '../services/workflow';

function AddParticipantControl({ memoId, users, existingParticipantIds, onActionComplete }) {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const existingSet = new Set(existingParticipantIds);
  const candidates = users.filter((user) => !existingSet.has(user._id));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!userId) {
      setError('Select a user to add');
      return;
    }

    setBusy(true);
    try {
      await addWorkflowParticipant(memoId, userId, reason);
      setUserId('');
      setReason('');
      await onActionComplete();
    } catch (addError) {
      setError(addError.response?.data?.message || 'Failed to add participant');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-700">Add a required participant</p>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Select a user...</option>
          {candidates.map((user) => (
            <option key={user._id} value={user._id}>
              {user.name} ({user.email})
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Reason (required)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-w-[12rem] flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  );
}

export default AddParticipantControl;
