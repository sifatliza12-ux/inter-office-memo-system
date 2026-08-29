import { PASSWORD_REQUIREMENTS } from '../../utils/passwordPolicy';
import { CheckIcon } from '../icons.jsx';

// Live checklist shown under a password field — reuses Field's existing
// hint/error color tokens (stone-500 muted, blue-700 for "met") rather than
// introducing a new status color, since this isn't a workflow-status
// indicator, just a plain UI affordance.
function PasswordRequirements({ password }) {
  return (
    <ul className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.test(password || '');
        return (
          <li
            key={requirement.key}
            className={`flex items-center gap-1.5 text-xs ${met ? 'text-blue-700' : 'text-stone-400'}`}
          >
            <span
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${
                met ? 'bg-blue-100' : 'bg-stone-100'
              }`}
              aria-hidden="true"
            >
              {met && <CheckIcon className="h-2.5 w-2.5" />}
            </span>
            {requirement.label}
          </li>
        );
      })}
    </ul>
  );
}

export default PasswordRequirements;
