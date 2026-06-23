import { v4 as uuidv4 } from 'uuid';
import { Patient, Clinic, QueueStats, AppointmentType, Language } from '../shared/types';
import * as db from '../db/supabase';
import { enrichQueueWithPositions, recordServiceCompletion } from './waitPredictor';
import * as sms from './smsService';
import {
  predictNoShowRisk, recordVisitOutcome, trackServiceVariance,
  getConfidenceBand, computeQueueHealth, NoShowRisk, ConfidenceBand, QueueHealth,
} from './queueIntelligence';

// In-memory state per clinic
interface ClinicState {
  clinic: Clinic;
  queue: Patient[]; // waiting + called + serving (active)
  done: Patient[];  // completed today (last 50)
  lastUpdated: number;
}

const clinicStates = new Map<string, ClinicState>();

// ─── Initialisation ───────────────────────────────────────────────────────────

export async function initClinic(clinicId: string): Promise<ClinicState | null> {
  const clinic = await db.getClinic(clinicId);
  if (!clinic) return null;

  const active = await db.getActiveQueue(clinicId);
  const done = await db.getTodayDone(clinicId);
  const enriched = enrichQueueWithPositions(active, clinic);

  const state: ClinicState = {
    clinic,
    queue: enriched,
    done,
    lastUpdated: Date.now(),
  };

  clinicStates.set(clinicId, state);
  console.log(`✅ Clinic loaded: ${clinic.name} — ${active.length} in queue`);
  return state;
}

export function getState(clinicId: string): ClinicState | undefined {
  return clinicStates.get(clinicId);
}

export function getAllClinicIds(): string[] {
  return Array.from(clinicStates.keys());
}

// ─── Queue actions ────────────────────────────────────────────────────────────

export async function addToQueue(clinicId: string, input: {
  name: string;
  phone: string;
  language: Language;
  type: AppointmentType;
  reason: string;
}): Promise<Patient | { error: string }> {
  const state = clinicStates.get(clinicId);
  if (!state) return { error: 'Clinic not found' };
  if (!state.clinic.isOpen) return { error: 'Clinic is currently closed' };

  // Duplicate check: same phone already in active queue
  const existing = state.queue.find(
    p => p.phone === input.phone && ['waiting', 'called', 'serving'].includes(p.status)
  );
  if (existing) return { error: 'You are already in the queue (ticket #' + existing.ticketNumber + ')' };

  const ticketNumber = await db.getNextTicketNumber(clinicId);

  const patient: Patient = {
    id: uuidv4(),
    ticketNumber,
    name: input.name,
    phone: input.phone,
    language: input.language,
    type: input.type,
    reason: input.reason,
    status: 'waiting',
    position: 0,
    estimatedWaitMinutes: 0,
    joinedAt: Date.now(),
    calledAt: null,
    servedAt: null,
    completedAt: null,
    clinicId,
    notified: false,
  };

  const saved = await db.addPatient(patient);
  if (!saved) return { error: 'Failed to save. Please try again.' };

  state.queue.push(saved);
  recalcPositions(state);

  // Find the enriched patient to get correct wait estimate
  const enriched = state.queue.find(p => p.id === saved.id)!;

  // Send join SMS
  sms.notifyJoined(enriched, state.clinic).then(ok => {
    if (ok) db.markPatientNotified(enriched.id);
  });

  state.lastUpdated = Date.now();
  return enriched;
}

export async function callNext(clinicId: string): Promise<Patient | { error: string }> {
  const state = clinicStates.get(clinicId);
  if (!state) return { error: 'Clinic not found' };

  // Find next waiting patient (appointments first, then walk-ins, then by time)
  const waiting = state.queue.filter(p => p.status === 'waiting');
  if (waiting.length === 0) return { error: 'Queue is empty' };

  // Priority: appointment > walk_in, then by joinedAt
  const appointments = waiting.filter(p => p.type === 'appointment');
  const next = appointments.length > 0
    ? appointments[0]
    : waiting[0];

  const updated = await db.updatePatientStatus(next.id, 'called', 'called_at');
  if (!updated) return { error: 'Database update failed' };

  // Update in memory
  const idx = state.queue.findIndex(p => p.id === next.id);
  if (idx >= 0) state.queue[idx] = { ...state.queue[idx], status: 'called', calledAt: Date.now() };

  recalcPositions(state);
  state.lastUpdated = Date.now();

  // Notify patient via SMS
  const enriched = state.queue.find(p => p.id === next.id)!;
  sms.notifyCalled(enriched, state.clinic);

  // Also send reminder to patients now at position 3 or less
  const nearlyNext = state.queue.filter(
    p => p.status === 'waiting' && p.position <= 3 && !p.notified
  );
  for (const p of nearlyNext) {
    sms.sendReminder(p, state.clinic).then(() => db.markPatientNotified(p.id));
    const pidx = state.queue.findIndex(q => q.id === p.id);
    if (pidx >= 0) state.queue[pidx].notified = true;
  }

  return enriched;
}

export async function markServing(clinicId: string, patientId: string): Promise<Patient | { error: string }> {
  const state = clinicStates.get(clinicId);
  if (!state) return { error: 'Clinic not found' };

  const updated = await db.updatePatientStatus(patientId, 'serving', 'served_at');
  if (!updated) return { error: 'Patient not found' };

  const idx = state.queue.findIndex(p => p.id === patientId);
  if (idx >= 0) state.queue[idx] = { ...state.queue[idx], status: 'serving', servedAt: Date.now() };

  recalcPositions(state);
  state.lastUpdated = Date.now();
  return state.queue[idx];
}

export async function markDone(clinicId: string, patientId: string): Promise<Patient | { error: string }> {
  const state = clinicStates.get(clinicId);
  if (!state) return { error: 'Clinic not found' };

  const patient = state.queue.find(p => p.id === patientId);
  if (!patient) return { error: 'Patient not found in active queue' };

  const now = Date.now();
  const updated = await db.updatePatientStatus(patientId, 'done', 'completed_at');
  if (!updated) return { error: 'Database update failed' };

  // Record service time for ML prediction
  if (patient.servedAt) {
    recordServiceCompletion(clinicId, patient.servedAt, now);
    trackServiceVariance(clinicId, now - patient.servedAt);

    // Update clinic's rolling avg in DB
    const { totalServed, avgServiceMs } = await db.getTodayStats(clinicId);
    if (totalServed > 0 && avgServiceMs > 0) {
      const avgMin = Math.round(avgServiceMs / 60_000);
      await db.updateAvgServiceTime(clinicId, avgMin);
      state.clinic.avgServiceMinutes = avgMin;
    }
  }

  recordVisitOutcome(patient.phone, new Date(patient.joinedAt).getHours(), false);

  const done = { ...patient, status: 'done' as const, completedAt: now };
  state.queue = state.queue.filter(p => p.id !== patientId);
  state.done.unshift(done);
  if (state.done.length > 50) state.done.pop();

  recalcPositions(state);
  state.lastUpdated = Date.now();
  return done;
}

export async function markNoShow(clinicId: string, patientId: string): Promise<Patient | { error: string }> {
  const state = clinicStates.get(clinicId);
  if (!state) return { error: 'Clinic not found' };

  const updated = await db.updatePatientStatus(patientId, 'no_show', 'completed_at');
  if (!updated) return { error: 'Patient not found' };

  const patient = state.queue.find(p => p.id === patientId)!;
  recordVisitOutcome(patient.phone, new Date(patient.joinedAt).getHours(), true);

  const done = { ...patient, status: 'no_show' as const, completedAt: Date.now() };
  state.queue = state.queue.filter(p => p.id !== patientId);
  state.done.unshift(done);

  recalcPositions(state);
  state.lastUpdated = Date.now();
  return done;
}

export async function updateStaff(clinicId: string, staffCount: number): Promise<void> {
  const state = clinicStates.get(clinicId);
  if (!state) return;

  const clampedCount = Math.max(1, Math.min(20, staffCount));
  state.clinic.staffCount = clampedCount;
  await db.updateClinicStaff(clinicId, clampedCount);
  recalcPositions(state);
  state.lastUpdated = Date.now();
}

export async function toggleOpen(clinicId: string, isOpen: boolean): Promise<void> {
  const state = clinicStates.get(clinicId);
  if (!state) return;
  state.clinic.isOpen = isOpen;
  await db.updateClinicOpen(clinicId, isOpen);
  state.lastUpdated = Date.now();
}

export function getStats(clinicId: string): QueueStats {
  const state = clinicStates.get(clinicId);
  if (!state) {
    return { waiting: 0, serving: 0, done: 0, avgWaitMinutes: 0, estimatedWaitForNew: 0, staffActive: 0 };
  }

  const waiting = state.queue.filter(p => p.status === 'waiting');
  const serving = state.queue.filter(p => p.status === 'serving' || p.status === 'called');
  const waitMinutes = waiting.map(p => p.estimatedWaitMinutes).filter(m => m > 0);

  // Estimate wait for a new patient joining now
  const newPosition = waiting.length + 1;
  const { predictWait } = require('./waitPredictor');
  const newPrediction = predictWait(newPosition, state.clinic, state.queue);

  return {
    waiting: waiting.length,
    serving: serving.length,
    done: state.done.filter(p => p.status === 'done').length,
    avgWaitMinutes: waitMinutes.length > 0
      ? Math.round(waitMinutes.reduce((a, b) => a + b, 0) / waitMinutes.length)
      : 0,
    estimatedWaitForNew: newPrediction.estimatedMinutes,
    staffActive: state.clinic.staffCount,
  };
}

export async function getStatusByPhone(clinicId: string, phone: string): Promise<Patient | null> {
  const state = clinicStates.get(clinicId);
  if (!state) return null;

  // Check in-memory first
  const inMemory = state.queue.find(p => p.phone === phone && ['waiting', 'called', 'serving'].includes(p.status));
  if (inMemory) return inMemory;

  // Fall back to DB
  return db.getPatientByPhone(clinicId, phone);
}

export function getQueueHealth(clinicId: string): QueueHealth | null {
  const state = clinicStates.get(clinicId);
  if (!state) return null;
  const stats = getStats(clinicId);
  return computeQueueHealth(state.queue, state.clinic, stats.avgWaitMinutes);
}

export interface EnrichedPatient extends Patient {
  noShowRisk?: NoShowRisk;
  confidenceBand?: ConfidenceBand;
}

export function getEnrichedQueue(clinicId: string): EnrichedPatient[] {
  const state = clinicStates.get(clinicId);
  if (!state) return [];

  return state.queue.map(p => {
    if (p.status !== 'waiting') return p;
    return {
      ...p,
      noShowRisk: predictNoShowRisk(p),
      confidenceBand: getConfidenceBand(p.estimatedWaitMinutes, clinicId),
    };
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function recalcPositions(state: ClinicState): void {
  state.queue = enrichQueueWithPositions(state.queue, state.clinic);
}
