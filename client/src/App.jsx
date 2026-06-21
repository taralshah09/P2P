import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import SenderPage from './pages/SenderPage.jsx';
import ReceiverPage from './pages/ReceiverPage.jsx';

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/send" element={<SenderPage />} />
        <Route path="/receive" element={<ReceiverPage />} />
        <Route path="/join/:code" element={<ReceiverPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
