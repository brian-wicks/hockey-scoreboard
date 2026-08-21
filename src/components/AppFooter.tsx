import { Link, useLocation } from 'react-router-dom';

export default function AppFooter() {
  // Only /game renders AppSidebar's mobile bottom tab bar — everywhere else (including
  // the Dashboard) has nothing at the bottom to dodge.
  const location = useLocation();
  const hasBottomNav = location.pathname === '/game';

  return (
    <footer className={`fixed right-3 z-40 ${hasBottomNav ? 'bottom-16 md:bottom-3' : 'bottom-3'}`}>
      <Link
        to="/changelog"
        className="inline-flex items-center rounded-md border border-zinc-800/80 bg-zinc-950/90 px-2 py-1 text-xs font-mono text-zinc-300 backdrop-blur-sm transition-colors hover:text-white"
        title="View changelog"
      >
        v{__APP_VERSION__}
      </Link>
    </footer>
  );
}
