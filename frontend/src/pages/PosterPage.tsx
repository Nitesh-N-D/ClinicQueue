import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, ArrowLeft, Copy, Check } from 'lucide-react';

const CLINIC_ID = import.meta.env.VITE_CLINIC_ID ?? 'a0000000-0000-0000-0000-000000000001';

export default function PosterPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const joinUrl = `${window.location.origin}/join?clinic=${CLINIC_ID}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Controls — hidden when printing */}
      <div className="print:hidden p-4 flex items-center justify-between bg-slate-950 sticky top-0 z-10">
        <button onClick={() => navigate('/staff')} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm">
          <ArrowLeft size={16} /> Back to dashboard
        </button>
        <div className="flex gap-2">
          <button onClick={handleCopy} className="btn-secondary text-sm py-1.5 px-3">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button onClick={() => window.print()} className="btn-primary text-sm py-1.5 px-3">
            <Printer size={14} /> Print poster
          </button>
        </div>
      </div>

      {/* Printable poster — A4 sized */}
      <div className="max-w-2xl mx-auto p-10 print:p-0">
        <div className="bg-white rounded-2xl print:rounded-none shadow-2xl print:shadow-none p-12 text-center border-8 border-sky-500 print:border-4">
          <div className="text-5xl mb-4">🏥</div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Join the Queue</h1>
          <p className="text-slate-600 mb-8 text-lg">Scan with your phone camera — no app needed</p>

          <div className="flex justify-center mb-8">
            <div className="p-4 bg-white border-2 border-slate-200 rounded-xl">
              <QRCodeSVG value={joinUrl} size={220} level="H" fgColor="#0f172a" />
            </div>
          </div>

          <div className="bg-sky-50 rounded-xl p-4 mb-6">
            <p className="text-slate-500 text-sm mb-1">Or text to join:</p>
            <p className="text-2xl font-mono font-bold text-sky-700">JOIN to (555) 000-0000</p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm text-slate-600">
            <div>
              <p className="text-2xl mb-1">📱</p>
              <p>No app download</p>
            </div>
            <div>
              <p className="text-2xl mb-1">⏱️</p>
              <p>Live wait estimate</p>
            </div>
            <div>
              <p className="text-2xl mb-1">💬</p>
              <p>SMS updates</p>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm mt-4 print:hidden">
          Print this and place it at your front desk or waiting room entrance
        </p>
      </div>
    </div>
  );
}
