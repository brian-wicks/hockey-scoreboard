/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import AppFooter from './components/AppFooter';
import ChangelogPage from './components/ChangelogPage';
import ControlPanel from './components/ControlPanel';
import JumbotronScoreboard from './components/JumbotronScoreboard';
import Overlay from './components/Overlay';

function AppRoutes() {
  const location = useLocation();
  const showFooter = location.pathname !== '/overlay' && location.pathname !== '/jumbotron';

  return (
    <>
      <Routes>
        <Route path="/" element={<ControlPanel />} />
        <Route path="/overlay" element={<Overlay />} />
        <Route path="/jumbotron" element={<JumbotronScoreboard />} />
        <Route path="/changelog" element={<ChangelogPage />} />
      </Routes>
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
