import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { Clinic, Patient, QueueStatus } from '../shared/types';

export const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Clinic helpers ───────────────────────────────────────────────────────────

export async function getClinic(clinicId: string): Promise<Clinic | null> {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .single();
  if (error) return null;
  return rowToClinic(data);
}

export async function getAllClinics(): Promise<Clinic[]> {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .order('name');
  if (error || !data) return [];
  return data.map(rowToClinic);
}

export async function updateClinicStaff(clinicId: string, staffCount: number): Promise<void> {
  await supabase
    .from('clinics')
    .update({ staff_count: staffCount, updated_at: Date.now() })
    .eq('id', clinicId);
}

export async function updateClinicOpen(clinicId: string, isOpen: boolean): Promise<void> {
  await supabase
    .from('clinics')
    .update({ is_open: isOpen, updated_at: Date.now() })
    .eq('id', clinicId);
}

export async function updateAvgServiceTime(clinicId: string, avgMinutes: number): Promise<void> {
  await supabase
    .from('clinics')
    .update({ avg_service_minutes: Math.round(avgMinutes), updated_at: Date.now() })
    .eq('id', clinicId);
}

// ─── Patient / Queue helpers ──────────────────────────────────────────────────

export async function getNextTicketNumber(clinicId: string): Promise<number> {
  // Get max ticket for today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('patients')
    .select('ticket_number')
    .eq('clinic_id', clinicId)
    .gte('joined_at', todayStart.getTime())
    .order('ticket_number', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return 1;
  return (data[0].ticket_number as number) + 1;
}

export async function addPatient(patient: Omit<Patient, 'position' | 'estimatedWaitMinutes'>): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .insert({
      id: patient.id,
      ticket_number: patient.ticketNumber,
      name: patient.name,
      phone: patient.phone,
      language: patient.language,
      type: patient.type,
      reason: patient.reason,
      status: patient.status,
      joined_at: patient.joinedAt,
      called_at: null,
      served_at: null,
      completed_at: null,
      clinic_id: patient.clinicId,
      notified: false,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('addPatient error:', error);
    return null;
  }
  return rowToPatient(data);
}

export async function getActiveQueue(clinicId: string): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', clinicId)
    .in('status', ['waiting', 'called', 'serving'])
    .order('joined_at', { ascending: true });

  if (error || !data) return [];
  return data.map(rowToPatient);
}

export async function getTodayDone(clinicId: string): Promise<Patient[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', clinicId)
    .in('status', ['done', 'no_show'])
    .gte('joined_at', todayStart.getTime())
    .order('completed_at', { ascending: false })
    .limit(50);

  return (data || []).map(rowToPatient);
}

export async function updatePatientStatus(
  patientId: string,
  status: QueueStatus,
  timestampField?: 'called_at' | 'served_at' | 'completed_at'
): Promise<Patient | null> {
  const update: Record<string, unknown> = { status };
  if (timestampField) update[timestampField] = Date.now();

  const { data, error } = await supabase
    .from('patients')
    .update(update)
    .eq('id', patientId)
    .select()
    .single();

  if (error || !data) return null;
  return rowToPatient(data);
}

export async function markPatientNotified(patientId: string): Promise<void> {
  await supabase
    .from('patients')
    .update({ notified: true })
    .eq('id', patientId);
}

export async function getPatientByPhone(clinicId: string, phone: string): Promise<Patient | null> {
  const { data } = await supabase
    .from('patients')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('phone', phone)
    .in('status', ['waiting', 'called', 'serving'])
    .order('joined_at', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;
  return rowToPatient(data[0]);
}

export async function getTodayStats(clinicId: string): Promise<{
  totalServed: number;
  avgServiceMs: number;
  noShows: number;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('patients')
    .select('status, served_at, completed_at')
    .eq('clinic_id', clinicId)
    .gte('joined_at', todayStart.getTime());

  if (!data) return { totalServed: 0, avgServiceMs: 0, noShows: 0 };

  const done = data.filter(p => p.status === 'done');
  const noShows = data.filter(p => p.status === 'no_show').length;

  let totalServiceMs = 0;
  let countWithTime = 0;
  for (const p of done) {
    if (p.served_at && p.completed_at) {
      totalServiceMs += (p.completed_at as number) - (p.served_at as number);
      countWithTime++;
    }
  }

  return {
    totalServed: done.length,
    avgServiceMs: countWithTime > 0 ? totalServiceMs / countWithTime : 0,
    noShows,
  };
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToClinic(row: Record<string, unknown>): Clinic {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    address: row.address as string,
    staffCount: row.staff_count as number,
    isOpen: row.is_open as boolean,
    avgServiceMinutes: row.avg_service_minutes as number,
    createdAt: row.created_at as number,
  };
}

function rowToPatient(row: Record<string, unknown>): Patient {
  return {
    id: row.id as string,
    ticketNumber: row.ticket_number as number,
    name: row.name as string,
    phone: row.phone as string,
    language: row.language as Patient['language'],
    type: row.type as Patient['type'],
    reason: row.reason as string,
    status: row.status as QueueStatus,
    position: 0,
    estimatedWaitMinutes: 0,
    joinedAt: row.joined_at as number,
    calledAt: (row.called_at as number | null),
    servedAt: (row.served_at as number | null),
    completedAt: (row.completed_at as number | null),
    clinicId: row.clinic_id as string,
    notified: row.notified as boolean,
  };
}
