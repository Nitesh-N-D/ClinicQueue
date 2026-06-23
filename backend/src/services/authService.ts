import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { supabase } from '../db/supabase';

// A separate client using the anon key behaves the same for JWT verification,
// but we use supabase.auth.getUser(jwt) with the service role client, which
// is able to verify any user's access token server-side.

export interface StaffMember {
  id: string;
  clinicId: string;
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'staff';
  addedAt: number;
  lastLogin: number | null;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Verifies a Supabase access token (issued after Google OAuth login)
 * and returns the underlying user identity, or null if invalid/expired.
 */
export async function verifyAccessToken(accessToken: string): Promise<AuthenticatedUser | null> {
  if (!accessToken) return null;
  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) return null;

    const meta = data.user.user_metadata ?? {};
    return {
      userId: data.user.id,
      email: data.user.email ?? '',
      name: (meta.full_name as string) ?? (meta.name as string) ?? null,
      avatarUrl: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
    };
  } catch (err) {
    console.error('Token verification failed:', err);
    return null;
  }
}

/**
 * Checks if a user is an authorized staff member for a clinic.
 * If the user's email matches a pending invite, automatically promotes
 * them to staff_members on first login (invite-then-login flow).
 */
export async function resolveStaffAccess(
  clinicId: string,
  user: AuthenticatedUser
): Promise<StaffMember | null> {
  // 1. Already a registered staff member?
  const { data: existing } = await supabase
    .from('staff_members')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('user_id', user.userId)
    .single();

  if (existing) {
    await supabase
      .from('staff_members')
      .update({ last_login: Date.now(), name: user.name, avatar_url: user.avatarUrl })
      .eq('id', existing.id);
    return rowToStaffMember({ ...existing, last_login: Date.now() });
  }

  // 2. Pending invite for this email at this clinic?
  const { data: invite } = await supabase
    .from('staff_invites')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('email', user.email)
    .single();

  if (invite) {
    const { data: created } = await supabase
      .from('staff_members')
      .insert({
        clinic_id: clinicId,
        user_id: user.userId,
        email: user.email,
        name: user.name,
        avatar_url: user.avatarUrl,
        role: invite.role,
        added_at: Date.now(),
        last_login: Date.now(),
      })
      .select()
      .single();

    // Consume the invite
    await supabase.from('staff_invites').delete().eq('id', invite.id);

    if (created) return rowToStaffMember(created);
  }

  return null;
}

export async function listStaffMembers(clinicId: string): Promise<StaffMember[]> {
  const { data } = await supabase
    .from('staff_members')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('added_at', { ascending: true });
  return (data ?? []).map(rowToStaffMember);
}

export async function listPendingInvites(clinicId: string): Promise<Array<{ email: string; role: string; invitedAt: number }>> {
  const { data } = await supabase
    .from('staff_invites')
    .select('email, role, invited_at')
    .eq('clinic_id', clinicId);
  return (data ?? []).map(r => ({ email: r.email, role: r.role, invitedAt: r.invited_at }));
}

export async function inviteStaffMember(
  clinicId: string,
  email: string,
  role: 'admin' | 'staff',
  invitedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('staff_invites')
    .upsert({ clinic_id: clinicId, email: email.toLowerCase().trim(), role, invited_by: invitedBy, invited_at: Date.now() });
  return !error;
}

export async function removeStaffMember(clinicId: string, staffMemberId: string): Promise<boolean> {
  const { error } = await supabase
    .from('staff_members')
    .delete()
    .eq('clinic_id', clinicId)
    .eq('id', staffMemberId);
  return !error;
}

export async function revokeInvite(clinicId: string, email: string): Promise<boolean> {
  const { error } = await supabase
    .from('staff_invites')
    .delete()
    .eq('clinic_id', clinicId)
    .eq('email', email);
  return !error;
}

function rowToStaffMember(row: Record<string, unknown>): StaffMember {
  return {
    id: row.id as string,
    clinicId: row.clinic_id as string,
    userId: row.user_id as string,
    email: row.email as string,
    name: row.name as string | null,
    avatarUrl: row.avatar_url as string | null,
    role: row.role as 'admin' | 'staff',
    addedAt: row.added_at as number,
    lastLogin: row.last_login as number | null,
  };
}
