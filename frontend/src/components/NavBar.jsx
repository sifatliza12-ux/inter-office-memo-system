import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import {
  MemosIcon,
  InboxIcon,
  DashboardIcon,
  SearchIcon,
  AdminIcon,
  AuditIcon,
  ReportsIcon,
  DraftIcon,
  MenuIcon,
  CloseIcon,
  LogoutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from './icons.jsx';

// Architectural grouping — three functional sections rather than one flat
// list, so the sidebar reads as part of the application's structure ("where
// do I do X") rather than an alphabetical menu.
const WORK_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/memos', label: 'My Memos', icon: MemosIcon },
  { to: '/inbox', label: 'Inbox', icon: InboxIcon },
  // No dedicated Drafts route exists — this reuses My Memos' own existing
  // status filter via a query param; MyMemos.jsx reads it on mount.
  { to: '/memos?status=draft', label: 'Drafts', icon: DraftIcon },
];

const DISCOVER_LINKS = [{ to: '/search', label: 'Search', icon: SearchIcon }];

const MANAGEMENT_LINKS = [
  { to: '/admin', label: 'Admin', icon: AdminIcon, end: true },
  { to: '/admin/reports', label: 'Reports', icon: ReportsIcon },
  { to: '/admin/audit-log', label: 'Audit Log', icon: AuditIcon },
];

const GROUPS = [
  { heading: 'Work', links: WORK_LINKS },
  { heading: 'Discover', links: DISCOVER_LINKS },
];

const linkClasses = (isActive, collapsed) =>
  `group relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors duration-150 ${
    collapsed ? 'justify-center px-2' : 'px-3'
  } ${isActive ? 'bg-blue-700/80 text-white' : 'text-blue-100/70 hover:bg-blue-800/60 hover:text-white'}`;

// My Memos and Drafts both target the /memos path (Drafts via a query
// param), so plain NavLink prefix-matching can't tell them apart — this
// resolves which one (if either) should show active for a given link.
const isMemosLinkActive = (to, location) => {
  const isDraftsLink = to.includes('status=draft');
  const onMemosDraftView = location.pathname === '/memos' && location.search === '?status=draft';
  if (isDraftsLink) {
    return onMemosDraftView;
  }
  return location.pathname.startsWith('/memos') && !onMemosDraftView;
};

function NavLinkItem({ to, label, icon: Icon, end, collapsed, onNavigate }) {
  const location = useLocation();

  if (to.startsWith('/memos')) {
    const active = isMemosLinkActive(to, location);
    return (
      <Link to={to} onClick={onNavigate} className={linkClasses(active, collapsed)} title={collapsed ? label : undefined}>
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && label}
      </Link>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => linkClasses(isActive, collapsed)}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && label}
    </NavLink>
  );
}

function SidebarLinks({ onNavigate, collapsed = false }) {
  const { user } = useAuth();

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {GROUPS.map((group) => (
        <div key={group.heading} className="space-y-1">
          {!collapsed && (
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-blue-300/60">{group.heading}</p>
          )}
          {group.links.map((link) => (
            <NavLinkItem key={link.to} {...link} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      ))}

      {user?.role === 'admin' && (
        <div className="space-y-1">
          {!collapsed && (
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-blue-300/60">Management</p>
          )}
          {MANAGEMENT_LINKS.map((link) => (
            <NavLinkItem key={link.to} {...link} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </nav>
  );
}

function NavBar({ collapsed = false, onToggleCollapse }) {
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
          <Link to="/" className="hidden font-mono text-sm font-semibold tracking-tight text-blue-800 sm:inline">
            Inter-Office Memo
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <NavLink
            to="/search"
            className="hidden rounded-md p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-blue-700 sm:inline-flex"
            aria-label="Search memos"
          >
            <SearchIcon className="h-[18px] w-[18px]" />
          </NavLink>
          <NotificationBell />
          <div className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" />
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
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

      <aside
        className={`fixed inset-y-0 left-0 z-20 hidden flex-col bg-blue-900 pt-16 transition-[width] duration-200 ease-out lg:flex ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        <SidebarLinks collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`flex items-center gap-2.5 border-t border-blue-800/80 px-3 py-3 text-xs font-medium text-blue-300/70 transition-colors hover:bg-blue-800/60 hover:text-white ${
            collapsed ? 'justify-center' : ''
          }`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon className="h-4 w-4 shrink-0" /> : <ChevronLeftIcon className="h-4 w-4 shrink-0" />}
          {!collapsed && 'Collapse'}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-blue-950/50 animate-fade-in" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-blue-900 shadow-xl animate-fade-in-up">
            <div className="flex h-16 items-center justify-between border-b border-blue-800 px-4">
              <span className="font-mono text-sm font-semibold text-white">Inter-Office Memo</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-blue-200 hover:bg-blue-800"
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
