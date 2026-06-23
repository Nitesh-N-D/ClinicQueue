import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Trash2, Mail, Shield, Clock, Loader2 } from 'lucide-react';
import { getTeam, inviteStaff, removeStaff, revokeInvite, StaffMember, PendingInvite } from '../lib/api';
import toast from 'react-hot-toast';

const CLINIC_ID = import.meta.env.VITE_CLINIC_ID ?? 'a0000000-0000-0000-0000-000000000001';

interface Props {
  onClose: () => void;
  isAdmin: boolean;
}

export default function TeamPanel({ onClose, isAdmin }: Props) {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff'>('staff');
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTeam(CLINIC_ID);
      setMembers(data.members);
      setInvites(data.invites);
    } catch {
      toast.error('Could not load team — Google auth may not be configured yet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }
    setInviting(true);
    try {
      await inviteStaff(CLINIC_ID, inviteEmail.trim(), inviteRole);
      toast.success(`Invited ${inviteEmail} — they can now sign in with Google`);
      setInviteEmail('');
      load();
    } catch {
      toast.error('Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (member: StaffMember) => {
    if (!confirm(`Remove ${member.name ?? member.email} from staff access?`)) return;
    await removeStaff(CLINIC_ID, member.id);
    toast.success('Staff member removed');
    load();
  };

  const handleRevoke = async (email: string) => {
    await revokeInvite(CLINIC_ID, email);
    toast.success('Invite revoked');
    load();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="card w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Shield size={17} className="text-brand-400" /> Staff Access
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {isAdmin && (
          <form onSubmit={handleInvite} className="flex gap-2 mb-4">
            <input
              type="email"
              className="input flex-1"
              placeholder="teammate@email.com"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
            <select
              className="input w-24 flex-shrink-0"
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'admin' | 'staff')}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={inviting} className="btn-primary px-3 flex-shrink-0">
              {inviting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            </button>
          </form>
        )}

        {loading ? (
          <div className="text-center py-8 text-slate-500">
            <Loader2 size={20} className="animate-spin mx-auto mb-2" />
            Loading team...
          </div>
        ) : (
          <>
            {members.length === 0 && invites.length === 0 && (
              <div className="text-center py-6 text-slate-500 text-sm">
                No team members yet. Invite someone by email above, or have
                them sign in with Google after you add their email to the
                <code className="text-slate-400"> staff_invites</code> table.
              </div>
            )}

            {members.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Active staff ({members.length})</p>
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-3 bg-surface-hover rounded-lg p-2.5">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-white text-xs font-medium">
                          {(m.name ?? m.email)[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{m.name ?? m.email}</p>
                        <p className="text-slate-500 text-xs truncate">{m.email}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === 'admin' ? 'bg-brand-900/40 text-brand-300' : 'bg-slate-800 text-slate-400'}`}>
                        {m.role}
                      </span>
                      {isAdmin && (
                        <button onClick={() => handleRemove(m)} className="text-slate-500 hover:text-red-400 flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invites.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Pending invites ({invites.length})</p>
                <div className="space-y-2">
                  {invites.map(inv => (
                    <div key={inv.email} className="flex items-center gap-3 bg-amber-900/10 border border-amber-800/30 rounded-lg p-2.5">
                      <Mail size={15} className="text-amber-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-200 text-sm truncate">{inv.email}</p>
                        <p className="text-amber-500/70 text-xs flex items-center gap-1">
                          <Clock size={10} /> Waiting for first sign-in
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400">{inv.role}</span>
                      {isAdmin && (
                        <button onClick={() => handleRevoke(inv.email)} className="text-amber-500/60 hover:text-red-400 flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
