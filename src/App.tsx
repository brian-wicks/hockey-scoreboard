/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
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
  const authError = useStore((state) => state.authError);
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

  if (authError) {
    const err = authError.toLowerCase();
    const isNotFound = err.includes("not found") || err.includes("invalid") || err.includes("expired") || err.includes("no shareid");
    
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {isNotFound ? "Share Link Not Found" : "Connection Failed"}
          </h2>
          <p className="text-zinc-400 mb-6">
            {isNotFound 
              ? "The scoreboard you are looking for doesn't exist or the link has expired." 
              : authError}
          </p>
          <button
            onClick={() => {
              window.location.href = '/';
            }}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all mb-3 shadow-lg shadow-indigo-500/20"
          >
            Go to Homepage
          </button>
          <p className="text-xs text-zinc-500">
            If you are the owner, please check your share settings and generate a new link.
          </p>
        </div>
      </div>
    );
  }

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
