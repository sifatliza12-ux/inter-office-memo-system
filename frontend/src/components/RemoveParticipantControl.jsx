import { useState } from 'react';

import { removeWorkflowParticipant } from '../services/workflow';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Select from './ui/Select.jsx';
import Input from './ui/Input.jsx';

// candidates is pre-filtered by the caller to pending, not-yet-reached
// participants — never the current holder, never someone who already
// acted (see MemoDetail.jsx's removableCandidates).
function RemoveParticipantControl({ memoId, candidates, onActionComplete }) {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!userId) {
      setError('Select a user to remove');
      return;
    }

    setBusy(true);
    try {
      await removeWorkflowParticipant(memoId, userId, reason);
      setUserId('');
      setReason('');
      await onActionComplete();
    } catch (removeError) {
      setError(removeError.response?.data?.message || 'Failed to remove participant');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <p className="text-sm font-medium text-stone-700">Remove a participant</p>

        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

        <div className="mt-3 space-y-2">
          <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">Select a user...</option>
            {candidates.map((user) => (
              <option key={user._id} value={user._id}>
                {user.name}
              </option>
            ))}
          </Select>
          <Input
            required
            placeholder="Reason (required)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button type="submit" variant="danger" size="sm" disabled={busy} className="w-full">
            Remove
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default RemoveParticipantControl;
