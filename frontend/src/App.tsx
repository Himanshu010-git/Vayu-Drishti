import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { SubmitReportPage } from './pages/SubmitReportPage';
import { MyReportsPage } from './pages/MyReportsPage';
import { MapPage } from './pages/MapPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/submit" replace />} />
            <Route path="/submit" element={<SubmitReportPage />} />
            <Route path="/my-reports" element={<MyReportsPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="*" element={<Navigate to="/submit" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
