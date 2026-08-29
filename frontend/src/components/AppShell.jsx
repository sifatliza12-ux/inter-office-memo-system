import { useEffect, useState } from 'react';

import NavBar from './NavBar.jsx';

const COLLAPSE_KEY = 'imm-sidebar-collapsed';

// The single global shell every authenticated page renders into — owns the
// fixed NavBar plus the content gutter that reserves space for it, so the
// desktop sidebar's collapse/expand state has exactly one source of truth
// instead of being duplicated across every page's own wrapper div.
function AppShell({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      // Storage unavailable (private browsing, etc.) — collapse state just
      // won't persist across reloads; the toggle itself still works fine.
    }
  }, [collapsed]);

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-tangerine-50 pt-16 transition-[padding-left] duration-200 ease-out ${
        collapsed ? 'lg:pl-[68px]' : 'lg:pl-60'
      }`}
    >
      <NavBar collapsed={collapsed} onToggleCollapse={() => setCollapsed((prev) => !prev)} />
      {children}
    </div>
  );
}

export default AppShell;
