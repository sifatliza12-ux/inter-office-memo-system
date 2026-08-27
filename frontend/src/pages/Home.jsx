import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 text-center">
      <h1 className="text-2xl font-semibold text-gray-800">Inter-Office Memo Management System</h1>
      <p className="text-gray-600">
        Signed in as {user?.name} ({user?.email})
        {user?.organizationId?.name ? ` — ${user.organizationId.name}` : ''}
      </p>
      {user?.role === 'admin' && (
        <Link to="/admin" className="text-sm font-medium text-blue-600 hover:underline">
          Go to Administration
        </Link>
      )}
      <button
        onClick={logout}
        className="rounded bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
      >
        Logout
      </button>
    </div>
  );
}

export default Home;
