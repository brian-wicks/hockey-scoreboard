/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import AppFooter from './components/AppFooter';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { createLocalUser, isLocalMode } from './lib/localMode';
import { auth } from './lib/firebase';
import { useStore } from './store';
import { Login } from './components/Login';

const Dashboard = lazy(() => import('./components/Dashboard'));
const TeamManagerPage = lazy(() => import('./components/team/TeamManagerPage'));
const ControlPanel = lazy(() => import('./components/ControlPanel'));
const Overlay = lazy(() => import('./components/Overlay'));
const JumbotronScoreboard = lazy(() => import('./components/JumbotronScoreboard'));
const ChangelogPage = lazy(() => import('./components/ChangelogPage'));
const ResultsPage = lazy(() => import('./components/ResultsPage'));
const OperatorGate = lazy(() => import('./components/control-panel/OperatorGate'));

function AppRoutes() {
  const location = useLocation();
  const user = useStore((state) => state.user);
  const isViewer = useStore((state) => state.isViewer);
  const authLoading = useStore((state) => state.authLoading);
  const authError = useStore((state) => state.authError);
  const gameState = useStore((state) => state.gameState);
  const setUser = useStore((state) => state.setUser);
  const setAuthLoading = useStore((state) => state.setAuthLoading);
  const ensureInitialized = useStore((state) => state.ensureInitialized);

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized, user]);

  useEffect(() => {
    // Local mode has no Firebase to listen to: adopt the local operator once so
    // the app lands on the Dashboard exactly as a signed-in user would.
    if (isLocalMode() || !auth) {
      setUser(createLocalUser() as unknown as User);
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [setUser, setAuthLoading]);

  // Overlay, Jumbotron and Results stay exactly as they were (see design.md), and that
  // includes what they show while loading or failing to connect.
  const isBroadcastRoute = /\/(overlay|jumbotron|results)$/.test(location.pathname);
  const screenClass = isBroadcastRoute
    ? 'min-h-screen bg-slate-900 flex items-center justify-center text-white'
    : 'ui min-h-screen bg-canvas flex items-center justify-center';

  const isShareRoute = location.pathname.startsWith('/share/');
  // A second operator's session runs on its own token, so Firebase's loading state,
  // errors and signed-out screen don't apply here.
  const isOperatorRoute = location.pathname.startsWith('/operate/');
  const showFooter =
    !isOperatorRoute &&
    !isShareRoute &&
    location.pathname !== '/overlay' &&
    location.pathname !== '/jumbotron' &&
    location.pathname !== '/results';

  if (authError && !gameState && !isOperatorRoute) {
    const err = authError.toLowerCase();
    const isNotFound = err.includes("not found") || err.includes("invalid") || err.includes("expired") || err.includes("no shareid");
    
    return (
      <div className={`${screenClass} p-4`}>
        <div className={isBroadcastRoute
          ? "max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl"
          : "max-w-md w-full bg-canvas border border-line rounded-sm p-8"}
        >
          <div className={isBroadcastRoute ? "w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4" : "mb-4"}>
            <AlertCircle size={32} className={isBroadcastRoute ? "text-red-500" : "text-danger"} />
          </div>
          <h2 className={isBroadcastRoute ? "text-xl font-bold text-white mb-2" : "text-xl font-semibold mb-2"}>
            {isNotFound ? "Share link not found" : "Connection failed"}
          </h2>
          <p className={isBroadcastRoute ? "text-zinc-400 mb-6" : "text-muted mb-6"}>
            {isNotFound 
              ? "This scoreboard doesn't exist, or the link has been replaced." 
              : authError}
          </p>
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className={isBroadcastRoute
              ? "w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all mb-3 shadow-lg shadow-indigo-500/20"
              : "w-full py-3 bg-action hover:bg-action-hover text-canvas rounded-sm text-sm font-semibold transition-colors mb-3"}
          >
            Go to the home page
          </button>
          <p className={isBroadcastRoute ? "text-xs text-zinc-500" : "text-xs text-muted"}>
            If this is your game, open Share in the control panel to get the current links.
          </p>
        </div>
      </div>
    );
  }

  if (authLoading && !gameState && !isOperatorRoute) {
    return (
      <div className={screenClass}>
        <div className="flex flex-col items-center gap-4">
          {isBroadcastRoute && <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
          <p className={isBroadcastRoute ? 'text-zinc-400 font-medium tracking-wide' : 'text-muted'}>Connecting...</p>
        </div>
      </div>
    );
  }

  if (!user && !isViewer && !isOperatorRoute) {
    // The footer's version badge links here even when signed out, so it has to
    // work without an account — it's static data, nothing behind it needs auth.
    if (location.pathname === '/changelog') {
      return (
        <>
          <Suspense fallback={<div className={screenClass}>Loading...</div>}>
            <ChangelogPage />
          </Suspense>
          <AppFooter />
        </>
      );
    }

    return (
      <>
        <Login />
        <AppFooter />
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<div className={screenClass}>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/game" element={<ControlPanel />} />
          <Route path="/teams" element={<TeamManagerPage />} />
          <Route path="/overlay" element={<Overlay />} />
          <Route path="/jumbotron" element={<JumbotronScoreboard />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          
          {/* Share Routes */}
          <Route path="/share/:shareId" element={<ControlPanel />} />
          <Route path="/share/:shareId/overlay" element={<Overlay />} />
          <Route path="/share/:shareId/jumbotron" element={<JumbotronScoreboard />} />

          {/* Second operator */}
          <Route path="/operate/:operatorId" element={<OperatorGate><ControlPanel /></OperatorGate>} />
        </Routes>
      </Suspense>
      {showFooter && <AppFooter />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
