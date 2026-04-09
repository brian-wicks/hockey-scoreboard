/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import AppFooter from './components/AppFooter';

const ControlPanel = lazy(() => import('./components/ControlPanel'));
const Overlay = lazy(() => import('./components/Overlay'));
const JumbotronScoreboard = lazy(() => import('./components/JumbotronScoreboard'));
const ChangelogPage = lazy(() => import('./components/ChangelogPage'));
const ResultsPage = lazy(() => import('./components/ResultsPage'));

function AppRoutes() {
  const location = useLocation();
  const showFooter =
    location.pathname !== '/overlay' &&
    location.pathname !== '/jumbotron' &&
    location.pathname !== '/results';

  return (
    <>
      <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
        <Routes>
          <Route path="/" element={<ControlPanel />} />
          <Route path="/overlay" element={<Overlay />} />
          <Route path="/jumbotron" element={<JumbotronScoreboard />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
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
