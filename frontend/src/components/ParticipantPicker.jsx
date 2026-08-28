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
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Available users</p>
        <ul className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-md border border-stone-200 bg-stone-50/50 p-2">
          {availableUsers.map((user) => (
            <li key={user._id} className="flex items-center justify-between rounded px-1.5 py-1 text-sm hover:bg-white">
              <span className="text-stone-700">
                {user.name} <span className="text-stone-400">({user.email})</span>
              </span>
              <button
                type="button"
                onClick={() => addParticipant(user._id)}
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                Add
              </button>
            </li>
          ))}
          {availableUsers.length === 0 && <li className="px-1.5 py-1 text-sm text-stone-400">No more users to add.</li>}
        </ul>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Participants (approval order)</p>
        <ol className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-md border border-stone-200 bg-stone-50/50 p-2">
          {selectedIds.map((id, index) => {
            const user = userById(id);
            return (
              <li key={id} className="flex items-center justify-between rounded px-1.5 py-1 text-sm hover:bg-white">
                <span className="text-stone-700">
                  {index + 1}. {user ? user.name : id}
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => moveParticipant(index, -1)}
                    disabled={index === 0}
                    className="font-medium text-stone-500 hover:text-blue-700 hover:underline disabled:text-stone-300 disabled:no-underline"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveParticipant(index, 1)}
                    disabled={index === selectedIds.length - 1}
                    className="font-medium text-stone-500 hover:text-blue-700 hover:underline disabled:text-stone-300 disabled:no-underline"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => removeParticipant(id)}
                    className="font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
          {selectedIds.length === 0 && <li className="px-1.5 py-1 text-sm text-stone-400">No participants selected yet.</li>}
        </ol>
      </div>
    </div>
  );
}

export default ParticipantPicker;
