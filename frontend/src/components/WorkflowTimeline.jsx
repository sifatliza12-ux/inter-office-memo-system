const STATUS_STYLES = {
  pending: 'text-gray-500',
  approved: 'text-green-600',
  rejected: 'text-red-600',
  changes_requested: 'text-yellow-600',
};

function WorkflowTimeline({ steps }) {
  if (!steps || steps.length === 0) {
    return <p className="text-sm text-gray-400">This memo has not been submitted yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li key={step._id} className="rounded border border-gray-200 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-800">
              {index + 1}. {step.userId?.name || step.userId}
            </span>
            <span className={STATUS_STYLES[step.status] || 'text-gray-500'}>{step.status}</span>
          </div>
          {step.actionDate && (
            <p className="mt-1 text-xs text-gray-500">{new Date(step.actionDate).toLocaleString()}</p>
          )}
          {step.comment && <p className="mt-1 text-sm italic text-gray-700">"{step.comment}"</p>}
        </li>
      ))}
    </ol>
  );
}

export default WorkflowTimeline;
