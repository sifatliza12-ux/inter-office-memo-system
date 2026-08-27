function ParticipantPicker({ users, selectedIds, onChange }) {
  const selectedSet = new Set(selectedIds);
  const availableUsers = users.filter((user) => !selectedSet.has(user._id));
  const userById = (id) => users.find((user) => user._id === id);

  const addParticipant = (id) => onChange([...selectedIds, id]);
  const removeParticipant = (id) => onChange(selectedIds.filter((existingId) => existingId !== id));

  const moveParticipant = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedIds.length) {
      return;
    }
    const reordered = [...selectedIds];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    onChange(reordered);
  };

  return (
    <div className="mt-1 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <p className="text-xs font-medium uppercase text-gray-500">Available users</p>
        <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
          {availableUsers.map((user) => (
            <li key={user._id} className="flex items-center justify-between text-sm">
              <span>
                {user.name} <span className="text-gray-400">({user.email})</span>
              </span>
              <button type="button" onClick={() => addParticipant(user._id)} className="text-blue-600 hover:underline">
                Add
              </button>
            </li>
          ))}
          {availableUsers.length === 0 && <li className="text-sm text-gray-400">No more users to add.</li>}
        </ul>
      </div>

      <div>
        <p className="text-xs font-medium uppercase text-gray-500">Participants (approval order)</p>
        <ol className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
          {selectedIds.map((id, index) => {
            const user = userById(id);
            return (
              <li key={id} className="flex items-center justify-between text-sm">
                <span>
                  {index + 1}. {user ? user.name : id}
                </span>
                <span className="space-x-2">
                  <button
                    type="button"
                    onClick={() => moveParticipant(index, -1)}
                    disabled={index === 0}
                    className="text-gray-500 hover:underline disabled:text-gray-300"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveParticipant(index, 1)}
                    disabled={index === selectedIds.length - 1}
                    className="text-gray-500 hover:underline disabled:text-gray-300"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => removeParticipant(id)}
                    className="text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
          {selectedIds.length === 0 && <li className="text-sm text-gray-400">No participants selected yet.</li>}
        </ol>
      </div>
    </div>
  );
}

export default ParticipantPicker;
