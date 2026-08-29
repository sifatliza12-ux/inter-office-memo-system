import { StatusBadge } from './ui/Badge.jsx';

const DOT_CLASSES = {
  pending: 'bg-stone-300 ring-stone-100',
  approved: 'bg-emerald-500 ring-emerald-100',
  rejected: 'bg-red-500 ring-red-100',
  changes_requested: 'bg-amber-500 ring-amber-100',
};

function WorkflowTimeline({ steps }) {
  if (!steps || steps.length === 0) {
    return <p className="text-sm text-stone-500">This memo has not been submitted yet.</p>;
  }

  return (
    <ol className="relative space-y-5">
      {steps.map((step, index) => (
        <li key={step._id} className="relative flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={`z-10 mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ${DOT_CLASSES[step.status] || DOT_CLASSES.pending}`}
              aria-hidden="true"
            />
            {index < steps.length - 1 && <span className="mt-1 w-px flex-1 bg-stone-200" aria-hidden="true" />}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-stone-800">
                {index + 1}. {step.userId?.name || step.userId}
              </span>
              <StatusBadge status={step.status} />
            </div>
            {step.actionDate && (
              <p className="mt-0.5 text-xs text-stone-500">{new Date(step.actionDate).toLocaleString()}</p>
            )}
            {step.comment && <p className="mt-1 text-sm italic text-stone-600">&ldquo;{step.comment}&rdquo;</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default WorkflowTimeline;
