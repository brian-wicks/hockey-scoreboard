import { Link } from 'react-router-dom';

export default function AppFooter() {
  return (
    <footer className="fixed bottom-3 right-3 z-40">
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
