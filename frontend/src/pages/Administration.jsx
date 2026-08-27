import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import DepartmentsSection from '../components/DepartmentsSection.jsx';
import UsersSection from '../components/UsersSection.jsx';

function Administration() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Administration</h1>
            <Link to="/" className="text-sm text-blue-600 hover:underline">
              Back to home
            </Link>
          </div>
          <button
            onClick={logout}
            className="rounded bg-gray-800 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            Logout
          </button>
        </div>

        <DepartmentsSection />
        <UsersSection />
      </div>
    </div>
  );
}

export default Administration;
