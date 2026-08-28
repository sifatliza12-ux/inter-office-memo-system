import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import Card from '../components/ui/Card.jsx';
import { MemosIcon, InboxIcon, DashboardIcon, SearchIcon } from '../components/icons.jsx';

const QUICK_LINKS = [
  { to: '/inbox', label: 'Inbox', description: 'Memos waiting on your review', icon: InboxIcon },
  { to: '/memos', label: 'My Memos', description: 'Everything you have authored', icon: MemosIcon },
  { to: '/dashboard', label: 'Dashboard', description: 'Your activity at a glance', icon: DashboardIcon },
  { to: '/search', label: 'Search', description: 'Find any memo across the org', icon: SearchIcon },
];

function Home() {
  const { user } = useAuth();

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        <div className="animate-fade-in-up text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-tangerine-500">
            Inter-Office Memo Management System
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
            Welcome back, {user?.name?.split(' ')[0] || user?.name}
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            {user?.email}
            {user?.organizationId?.name ? ` — ${user.organizationId.name}` : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {QUICK_LINKS.map(({ to, label, description, icon: Icon }) => (
            <Link key={to} to={to} className="animate-fade-in-up">
              <Card hoverable className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-stone-900">{label}</p>
                  <p className="mt-0.5 text-sm text-stone-500">{description}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default Home;
