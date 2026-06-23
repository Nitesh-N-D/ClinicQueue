import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import JoinPage from './pages/JoinPage';
import StatusPage from './pages/StatusPage';
import CheckStatusPage from './pages/CheckStatusPage';
import StaffDashboard from './pages/StaffDashboard';
import StaffLogin from './pages/StaffLogin';
import LandingPage from './pages/LandingPage';
import DisplayBoard from './pages/DisplayBoard';
import PosterPage from './pages/PosterPage';
import NotFound from './pages/NotFound';
import { useAuth } from './hooks/useAuth';
import { setGoogleAccessToken, clearGoogleAccessToken, clearStaffPin } from './lib/api';

type AuthMode = 'pin' | 'google' | null;

function StaffRoute() {
  const { session, loading: authLoading, signOut, googleConfigured } = useAuth();
  const [pin, setPin] = useState<string | null>(localStorage.getItem('clinicqueue_pin'));
  const [mode, setMode] = useState<AuthMode>(null);

  // Restore Google session on refresh
  useEffect(() => {
    if (session?.access_token) {
      setGoogleAccessToken(session.access_token);
      setMode('google');
    }
  }, [session]);

  const handleLogin = (loginMode: 'pin' | 'google', enteredPin?: string) => {
    setMode(loginMode);
    if (loginMode === 'pin' && enteredPin) setPin(enteredPin);
  };

  const handleLogout = async () => {
    if (mode === 'google') {
      await signOut();
      clearGoogleAccessToken();
    } else {
      clearStaffPin();
    }
    setPin(null);
    setMode(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAuthed = mode === 'google' || (mode === 'pin' && !!pin) || (!mode && !!pin && !googleConfigured);

  if (!isAuthed) return <StaffLogin onLogin={handleLogin} />;

  return (
    <StaffDashboard
      authMode={mode === 'google' ? 'google' : 'pin'}
      pin={pin ?? ''}
      accessToken={session?.access_token}
      onLogout={handleLogout}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
          duration: 3000,
        }}
      />
      <Routes>
        <Route path="/"              element={<LandingPage />} />
        <Route path="/join"          element={<JoinPage />} />
        <Route path="/status/:patientId" element={<StatusPage />} />
        <Route path="/status/lookup" element={<StatusPage />} />
        <Route path="/check-status"  element={<CheckStatusPage />} />
        <Route path="/staff"         element={<StaffRoute />} />
        <Route path="/poster"        element={<PosterPage />} />
        <Route path="/display"       element={<DisplayBoard />} />
        <Route path="/404"           element={<NotFound />} />
        <Route path="*"              element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
