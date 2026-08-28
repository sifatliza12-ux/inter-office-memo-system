import { Navigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/ui/LoadingSpinner.jsx';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // UI convenience only — the real authorization check already happens
  // server-side (authorize('admin') on every route in this phase).
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
