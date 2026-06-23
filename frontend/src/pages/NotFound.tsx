import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <span className="text-6xl mb-4" role="img" aria-label="Lost">🧭</span>
      <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
      <p className="text-slate-400 mb-6">The page you're looking for doesn't exist.</p>
      <button onClick={() => navigate('/')} className="btn-primary py-2.5 px-5">
        <Home size={16} /> Back to home
      </button>
    </div>
  );
}
