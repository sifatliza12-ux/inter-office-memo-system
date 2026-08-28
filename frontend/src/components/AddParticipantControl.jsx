import { useState } from 'react';

import { addWorkflowParticipant } from '../services/workflow';
import Card from './ui/Card.jsx';
import Button from './ui/Button.jsx';
import Select from './ui/Select.jsx';
import Input from './ui/Input.jsx';

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
    <Card>
      <form onSubmit={handleSubmit}>
        <p className="text-sm font-medium text-stone-700">Add a required participant</p>

        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

        <div className="mt-3 space-y-2">
          <Select value={userId} onChange={(event) => setUserId(event.target.value)}>
            <option value="">Select a user...</option>
            {candidates.map((user) => (
              <option key={user._id} value={user._id}>
                {user.name} ({user.email})
              </option>
            ))}
          </Select>
          <Input
            required
            placeholder="Reason (required)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button type="submit" variant="secondary" size="sm" disabled={busy} className="w-full">
            Add
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default AddParticipantControl;
