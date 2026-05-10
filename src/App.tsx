/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import AppFooter from './components/AppFooter';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useStore } from './store';
import { Login } from './components/Login';

const ControlPanel = lazy(() => import('./components/ControlPanel'));
const Overlay = lazy(() => import('./components/Overlay'));
const JumbotronScoreboard = lazy(() => import('./components/JumbotronScoreboard'));
const ChangelogPage = lazy(() => import('./components/ChangelogPage'));
const ResultsPage = lazy(() => import('./components/ResultsPage'));

function AppRoutes() {
  const location = useLocation();
  const user = useStore((state) => state.user);
  const isViewer = useStore((state) => state.isViewer);
  const authLoading = useStore((state) => state.authLoading);
  const setUser = useStore((state) => state.setUser);
  const setAuthLoading = useStore((state) => state.setAuthLoading);
  const ensureInitialized = useStore((state) => state.ensureInitialized);

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized, user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [setUser, setAuthLoading]);

  const isShareRoute = location.pathname.startsWith('/share/');
  const showFooter =
    !isShareRoute &&
    location.pathname !== '/overlay' &&
    location.pathname !== '/jumbotron' &&
    location.pathname !== '/results';

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400 font-medium tracking-wide">Connecting...</p>
        </div>
      </div>
    );
  }

  if (!user && !isViewer) {
    return <Login />;
  }

  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
        <Routes>
          <Route path="/" element={<ControlPanel />} />
          <Route path="/overlay" element={<Overlay />} />
          <Route path="/jumbotron" element={<JumbotronScoreboard />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          
          {/* Share Routes */}
          <Route path="/share/:shareId" element={<ControlPanel />} />
          <Route path="/share/:shareId/overlay" element={<Overlay />} />
          <Route path="/share/:shareId/jumbotron" element={<JumbotronScoreboard />} />
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
