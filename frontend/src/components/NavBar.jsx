import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import {
  HomeIcon,
  MemosIcon,
  InboxIcon,
  DashboardIcon,
  SearchIcon,
  AdminIcon,
  AuditIcon,
  ReportsIcon,
  MenuIcon,
  CloseIcon,
  LogoutIcon,
} from './icons.jsx';

const NAV_LINKS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/memos', label: 'My Memos', icon: MemosIcon },
  { to: '/inbox', label: 'Inbox', icon: InboxIcon },
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/search', label: 'Search', icon: SearchIcon },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Administration', icon: AdminIcon },
  { to: '/admin/audit-log', label: 'Audit Log', icon: AuditIcon },
  { to: '/admin/reports', label: 'Reports', icon: ReportsIcon },
];

const linkClasses = ({ isActive }) =>
  `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
    isActive ? 'bg-plum-700/80 text-white' : 'text-plum-100/70 hover:bg-plum-800/60 hover:text-white'
  }`;

function SidebarLinks({ onNavigate }) {
  const { user } = useAuth();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      <div className="space-y-1">
        {NAV_LINKS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClasses} onClick={onNavigate}>
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </div>

      {user?.role === 'admin' && (
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-plum-300/60">Administration</p>
          {ADMIN_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkClasses} onClick={onNavigate}>
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}

function NavBar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) {
    return null;
  }

  const initial = user.name?.trim()?.[0]?.toUpperCase() || '?';

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-stone-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-stone-500 hover:bg-stone-100 lg:hidden"
            aria-label="Open navigation menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="hidden font-mono text-sm font-semibold tracking-tight text-plum-800 sm:inline">
            Inter-Office Memo
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <NavLink
            to="/search"
            className="hidden rounded-md p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-plum-700 sm:inline-flex"
            aria-label="Search memos"
          >
            <SearchIcon className="h-[18px] w-[18px]" />
          </NavLink>
          <NotificationBell />
          <div className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" />
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-plum-100 text-xs font-semibold text-plum-700">
              {initial}
            </span>
            <span className="text-sm font-medium text-stone-700">{user.name}</span>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
          >
            <LogoutIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-plum-900 pt-16 lg:flex">
        <SidebarLinks />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-plum-950/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-plum-900 shadow-xl animate-fade-in-up">
            <div className="flex h-16 items-center justify-between border-b border-plum-800 px-4">
              <span className="font-mono text-sm font-semibold text-white">Inter-Office Memo</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-plum-200 hover:bg-plum-800"
                aria-label="Close navigation menu"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <SidebarLinks onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

export default NavBar;
