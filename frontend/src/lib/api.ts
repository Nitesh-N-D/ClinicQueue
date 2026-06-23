import axios from 'axios';
import { Patient, Clinic, QueueStats, Language, AppointmentType } from '../shared/types';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

const api = axios.create({ baseURL: BASE, timeout: 10000 });

// Staff PIN interceptor (legacy fallback)
let staffPin = localStorage.getItem('clinicqueue_pin') ?? '';
export const setStaffPin = (pin: string) => {
  staffPin = pin;
  localStorage.setItem('clinicqueue_pin', pin);
};
export const clearStaffPin = () => {
  staffPin = '';
  localStorage.removeItem('clinicqueue_pin');
};

// Google access token (primary auth) — set after Supabase OAuth login
let googleAccessToken = '';
export const setGoogleAccessToken = (token: string) => { googleAccessToken = token; };
export const clearGoogleAccessToken = () => { googleAccessToken = ''; };

api.interceptors.request.use(cfg => {
  if (googleAccessToken) {
    cfg.headers.Authorization = `Bearer ${googleAccessToken}`;
  } else if (staffPin) {
    cfg.headers['x-staff-pin'] = staffPin;
  }
  return cfg;
});

// ─── Public ───────────────────────────────────────────────────────────────────

export interface PublicQueueState {
  queue: Array<{
    ticketNumber: number;
    status: string;
    position: number;
    estimatedWaitMinutes: number;
    type: string;
  }>;
  stats: QueueStats;
  clinic: { name: string; isOpen: boolean };
}

export async function getPublicQueue(clinicId: string): Promise<PublicQueueState> {
  const { data } = await api.get(`/clinics/${clinicId}/queue`);
  return data;
}

export async function getClinicInfo(clinicId: string): Promise<{ clinic: Clinic; stats: QueueStats; isOpen: boolean }> {
  const { data } = await api.get(`/clinics/${clinicId}`);
  return data;
}

export async function joinQueue(clinicId: string, payload: {
  name: string;
  phone: string;
  language: Language;
  type: AppointmentType;
  reason: string;
}): Promise<Patient> {
  const { data } = await api.post(`/clinics/${clinicId}/queue/join`, payload);
  return data;
}

export async function getMyStatus(clinicId: string, phone: string): Promise<{
  ticketNumber: number;
  status: string;
  position: number;
  estimatedWaitMinutes: number;
  name: string;
}> {
  const { data } = await api.get(`/clinics/${clinicId}/queue/status`, { params: { phone } });
  return data;
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface StaffQueueState {
  clinic: Clinic;
  queue: Patient[];
  done: Patient[];
  stats: QueueStats;
}

export async function getStaffQueue(clinicId: string): Promise<StaffQueueState> {
  const { data } = await api.get(`/clinics/${clinicId}/staff/queue`);
  return data;
}

export async function callNext(clinicId: string): Promise<Patient> {
  const { data } = await api.post(`/clinics/${clinicId}/staff/call-next`);
  return data;
}

export async function markServing(clinicId: string, patientId: string): Promise<Patient> {
  const { data } = await api.post(`/clinics/${clinicId}/staff/serving/${patientId}`);
  return data;
}

export async function markDone(clinicId: string, patientId: string): Promise<Patient> {
  const { data } = await api.post(`/clinics/${clinicId}/staff/done/${patientId}`);
  return data;
}

export async function markNoShow(clinicId: string, patientId: string): Promise<Patient> {
  const { data } = await api.post(`/clinics/${clinicId}/staff/no-show/${patientId}`);
  return data;
}

export async function updateStaffCount(clinicId: string, count: number): Promise<void> {
  await api.post(`/clinics/${clinicId}/staff/count`, { count });
}

export async function toggleOpen(clinicId: string, isOpen: boolean): Promise<void> {
  await api.post(`/clinics/${clinicId}/staff/toggle-open`, { isOpen });
}

export async function verifyPin(clinicId: string, pin: string): Promise<boolean> {
  try {
    await api.get(`/clinics/${clinicId}/staff/queue`, {
      headers: { 'x-staff-pin': pin },
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Staff team management (Google auth) ───────────────────────────────────────

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

export interface PendingInvite {
  email: string;
  role: string;
  invitedAt: number;
}

export async function getMe(clinicId: string): Promise<{ staffMember: StaffMember | null; authMethod: 'google' | 'pin' }> {
  const { data } = await api.get(`/clinics/${clinicId}/staff/me`);
  return data;
}

export async function getTeam(clinicId: string): Promise<{ members: StaffMember[]; invites: PendingInvite[] }> {
  const { data } = await api.get(`/clinics/${clinicId}/staff/team`);
  return data;
}

export async function inviteStaff(clinicId: string, email: string, role: 'admin' | 'staff'): Promise<void> {
  await api.post(`/clinics/${clinicId}/staff/invite`, { email, role });
}

export async function removeStaff(clinicId: string, staffMemberId: string): Promise<void> {
  await api.delete(`/clinics/${clinicId}/staff/team/${staffMemberId}`);
}

export async function revokeInvite(clinicId: string, email: string): Promise<void> {
  await api.delete(`/clinics/${clinicId}/staff/invite/${encodeURIComponent(email)}`);
}
