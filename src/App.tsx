/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import HostDashboard from './pages/HostDashboard';
import HostCreate from './pages/HostCreate';
import HostRoom from './pages/HostRoom';
import PlayerJoin from './pages/PlayerJoin';
import PlayerRoom from './pages/PlayerRoom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<HostDashboard />} />
        <Route path="/host/create" element={<HostCreate />} />
        <Route path="/host/room/:roomId" element={<HostRoom />} />
        <Route path="/join/:pin" element={<PlayerJoin />} />
        <Route path="/play/:roomId" element={<PlayerRoom />} />
      </Routes>
    </BrowserRouter>
  );
}
