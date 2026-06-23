import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Smartphone, MessageSquare, Clock, Globe, Shield, Heart,
  ArrowRight, CheckCircle2, Users, Monitor,
} from 'lucide-react';

const FEATURES = [
  { icon: MessageSquare, title: 'SMS-first', desc: 'No app or smartphone required — works on any phone via text message.' },
  { icon: Clock,         title: 'Honest wait ranges', desc: 'A confidence range, not a fake-precise number — built from real recent service times.' },
  { icon: Globe,         title: '5 languages built in', desc: 'English, Spanish, Hindi, Tamil, and French — patients choose their own.' },
  { icon: Shield,        title: 'No-show risk prediction', desc: 'Learns patterns per patient and time slot so staff can plan around likely no-shows.' },
  { icon: Monitor,       title: 'Live queue health score', desc: 'One glance tells staff if the clinic is running smoothly or needs more hands.' },
  { icon: Heart,         title: 'Free QR poster generator', desc: 'Print a wall poster with a scannable join code in seconds — zero design work.' },
];

const STEPS = [
  { num: '1', title: 'Patient joins the queue', desc: 'Scan a QR code or visit a link. Enter name, phone, and reason for visit. No app download.' },
  { num: '2', title: 'Get SMS updates automatically', desc: 'Receive your ticket number and wait estimate by text. Get notified when it\'s your turn.' },
  { num: '3', title: 'Staff manages it all from one screen', desc: 'Front desk calls the next patient with one tap. Queue updates live for everyone.' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* SEO: semantic header */}
      <header className="px-4 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label="Clinic">🏥</span>
          <span className="text-lg font-bold text-white">ClinicQueue</span>
        </div>
        <nav className="flex items-center gap-3">
          <button onClick={() => navigate('/check-status')} className="text-slate-400 hover:text-white text-sm hidden sm:block">
            Check status
          </button>
          <button onClick={() => navigate('/staff')} className="btn-secondary text-sm py-1.5 px-3">
            Staff login
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className="px-4 py-16 sm:py-24 text-center max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <span className="inline-block bg-brand-900/40 text-brand-300 border border-brand-700/40 rounded-full px-3 py-1 text-xs font-medium mb-5">
            Free for community health clinics
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-4">
            Queue management that works<br className="hidden sm:block" /> without a smartphone
          </h1>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Free, SMS-based queue management built for walk-in clinics, FQHCs, and
            NGO health centers. No app. No smartphone required. No monthly fee.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate('/join')} className="btn-primary py-3 px-6 text-base">
              Join a queue <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate('/staff')} className="btn-secondary py-3 px-6 text-base">
              I'm clinic staff
            </button>
          </div>
        </motion.div>
      </section>

      {/* Stats strip */}
      <section className="px-4 py-8 border-y border-surface-border bg-surface-card/50">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-white">1,400+</p>
            <p className="text-slate-400 text-sm">FQHCs in the US could use this today</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">$0</p>
            <p className="text-slate-400 text-sm">monthly cost — vs $50+ for competitors</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-white">5</p>
            <p className="text-slate-400 text-sm">languages supported out of the box</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-white text-center mb-10">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card text-center"
            >
              <div className="w-9 h-9 bg-brand-600 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-3">
                {s.num}
              </div>
              <h3 className="text-white font-semibold mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="px-4 py-16 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-white text-center mb-10">
          Built for clinics that can't afford to overpay
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="card"
            >
              <f.icon size={22} className="text-brand-400 mb-3" />
              <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="px-4 py-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          Why not just use Waitwhile or QueueBuster?
        </h2>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left p-3 text-slate-400 font-medium">Feature</th>
                <th className="text-center p-3 text-slate-400 font-medium">Paid tools</th>
                <th className="text-center p-3 text-brand-400 font-medium">ClinicQueue</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Monthly cost', '$50–200+', 'Free'],
                ['Works without smartphone', 'Rarely', 'Yes (SMS)'],
                ['Built for healthcare', 'No (retail-focused)', 'Yes'],
                ['Multi-language SMS', 'Limited', '5 languages'],
                ['ML wait prediction', 'Sometimes', 'Yes'],
              ].map(([feat, paid, free]) => (
                <tr key={feat} className="border-b border-surface-border last:border-0">
                  <td className="p-3 text-slate-300">{feat}</td>
                  <td className="p-3 text-center text-slate-500">{paid}</td>
                  <td className="p-3 text-center text-emerald-400 font-medium">
                    <CheckCircle2 size={14} className="inline mr-1" />{free}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 text-center max-w-2xl mx-auto">
        <Users size={32} className="text-brand-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-3">
          Run a free or community clinic?
        </h2>
        <p className="text-slate-400 mb-6">
          Set up ClinicQueue in minutes. No credit card, no contract, no IT team needed.
        </p>
        <button onClick={() => navigate('/staff')} className="btn-primary py-3 px-6 text-base mx-auto">
          Get started free <ArrowRight size={18} />
        </button>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 border-t border-surface-border text-center">
        <p className="text-slate-500 text-sm">
          ClinicQueue — Free queue management for community health clinics.
        </p>
        <div className="flex items-center gap-4 justify-center mt-3 text-xs text-slate-600">
          <button onClick={() => navigate('/join')} className="hover:text-slate-400">Join queue</button>
          <span>·</span>
          <button onClick={() => navigate('/check-status')} className="hover:text-slate-400">Check status</button>
          <span>·</span>
          <button onClick={() => navigate('/display')} className="hover:text-slate-400">Display board</button>
          <span>·</span>
          <button onClick={() => navigate('/poster')} className="hover:text-slate-400">QR poster</button>
        </div>
      </footer>
    </div>
  );
}
