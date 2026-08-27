import { NavLink } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';

const linkClasses = ({ isActive }) =>
  `text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`;

function NavBar() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-5">
        <NavLink to="/" end className={linkClasses}>
          Home
        </NavLink>
        <NavLink to="/memos" className={linkClasses}>
          My Memos
        </NavLink>
        <NavLink to="/inbox" className={linkClasses}>
          Inbox
        </NavLink>
        <NavLink to="/dashboard" className={linkClasses}>
          Dashboard
        </NavLink>
        <NavLink to="/search" className={linkClasses}>
          Search
        </NavLink>
        {user.role === 'admin' && (
          <NavLink to="/admin" className={linkClasses}>
            Administration
          </NavLink>
        )}
        {user.role === 'admin' && (
          <NavLink to="/admin/audit-log" className={linkClasses}>
            Audit Log
          </NavLink>
        )}
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <span className="text-sm text-gray-500">{user.name}</span>
        <button
          onClick={logout}
          className="rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

export default NavBar;
