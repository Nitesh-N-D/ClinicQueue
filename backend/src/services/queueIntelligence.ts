import { Patient, Clinic } from '../shared/types';

// ─── No-show risk prediction ──────────────────────────────────────────────────
// Tracks historical no-show patterns per phone number and time-of-day bucket.

interface NoShowHistory {
  totalVisits: number;
  noShows: number;
}

const noShowHistory = new Map<string, NoShowHistory>(); // key = phone number
const timeOfDayNoShowRate = new Map<number, { total: number; noShows: number }>(); // key = hour 0-23

export function recordVisitOutcome(phone: string, hourOfDay: number, wasNoShow: boolean): void {
  const patientHist = noShowHistory.get(phone) ?? { totalVisits: 0, noShows: 0 };
  patientHist.totalVisits++;
  if (wasNoShow) patientHist.noShows++;
  noShowHistory.set(phone, patientHist);

  const hourHist = timeOfDayNoShowRate.get(hourOfDay) ?? { total: 0, noShows: 0 };
  hourHist.total++;
  if (wasNoShow) hourHist.noShows++;
  timeOfDayNoShowRate.set(hourOfDay, hourHist);
}

export interface NoShowRisk {
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  reason: string;
}

export function predictNoShowRisk(patient: Patient): NoShowRisk {
  const personalHist = noShowHistory.get(patient.phone);
  const hour = new Date(patient.joinedAt).getHours();
  const hourHist = timeOfDayNoShowRate.get(hour);

  let score = 15; // baseline risk
  const reasons: string[] = [];

  // Personal history (strongest signal)
  if (personalHist && personalHist.totalVisits >= 2) {
    const personalRate = personalHist.noShows / personalHist.totalVisits;
    score += personalRate * 50;
    if (personalRate > 0.3) reasons.push('history of missed visits');
  }

  // Time of day pattern
  if (hourHist && hourHist.total >= 5) {
    const hourRate = hourHist.noShows / hourHist.total;
    score += hourRate * 25;
    if (hourRate > 0.25) reasons.push('this time slot has higher no-show rates');
  }

  // Long wait correlation — patients waiting > 45 min predicted are more likely to leave
  if (patient.estimatedWaitMinutes > 45) {
    score += 15;
    reasons.push('long wait time');
  }

  // Walk-ins have slightly higher no-show than appointments
  if (patient.type === 'walk_in') {
    score += 5;
  }

  score = Math.min(95, Math.round(score));

  const riskLevel: NoShowRisk['riskLevel'] = score >= 55 ? 'high' : score >= 30 ? 'medium' : 'low';
  const reason = reasons.length > 0 ? reasons.join(', ') : 'no risk factors detected';

  return { riskScore: score, riskLevel, reason };
}

// ─── Confidence-band ETA ──────────────────────────────────────────────────────
// Instead of a single number, give a range based on variance in recent service times.

const serviceTimeVariance = new Map<string, number[]>(); // clinicId → recent durations (ms)

export function trackServiceVariance(clinicId: string, durationMs: number): void {
  const arr = serviceTimeVariance.get(clinicId) ?? [];
  arr.push(durationMs);
  if (arr.length > 15) arr.shift();
  serviceTimeVariance.set(clinicId, arr);
}

export interface ConfidenceBand {
  low: number;
  expected: number;
  high: number;
}

export function getConfidenceBand(estimatedMinutes: number, clinicId: string): ConfidenceBand {
  const history = serviceTimeVariance.get(clinicId);

  if (!history || history.length < 4) {
    // Not enough data — wide generic band
    return {
      low: Math.max(0, Math.round(estimatedMinutes * 0.6)),
      expected: estimatedMinutes,
      high: Math.round(estimatedMinutes * 1.5),
    };
  }

  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
  const stdDevMin = Math.sqrt(variance) / 60_000;

  // Scale std dev by how many "slots" of waiting are ahead
  const slots = Math.max(1, estimatedMinutes / Math.max(1, mean / 60_000));
  const spread = stdDevMin * Math.sqrt(slots);

  return {
    low: Math.max(0, Math.round(estimatedMinutes - spread)),
    expected: estimatedMinutes,
    high: Math.round(estimatedMinutes + spread * 1.5),
  };
}

// ─── Queue health score ───────────────────────────────────────────────────────
// A single 0-100 "how well is this clinic running right now" metric, combining
// wait times, staff utilization, and no-show rate.

export interface QueueHealth {
  score: number; // 0-100, higher is healthier
  status: 'excellent' | 'good' | 'strained' | 'critical';
  factors: { label: string; impact: 'positive' | 'negative'; detail: string }[];
}

export function computeQueueHealth(
  queue: Patient[],
  clinic: Clinic,
  avgWaitMinutes: number
): QueueHealth {
  let score = 100;
  const factors: QueueHealth['factors'] = [];

  const waiting = queue.filter(p => p.status === 'waiting');
  const serving = queue.filter(p => p.status === 'serving' || p.status === 'called');

  // Factor 1: Wait time vs staff capacity
  const waitPerStaff = waiting.length / Math.max(1, clinic.staffCount);
  if (waitPerStaff > 5) {
    score -= 30;
    factors.push({ label: 'Heavy backlog', impact: 'negative', detail: `${waiting.length} patients waiting with only ${clinic.staffCount} staff` });
  } else if (waitPerStaff > 2.5) {
    score -= 12;
    factors.push({ label: 'Building backlog', impact: 'negative', detail: `Queue growing faster than staff capacity` });
  } else {
    factors.push({ label: 'Manageable queue', impact: 'positive', detail: `${waiting.length} waiting, well within capacity` });
  }

  // Factor 2: Average wait time
  if (avgWaitMinutes > 60) {
    score -= 25;
    factors.push({ label: 'Long average wait', impact: 'negative', detail: `${avgWaitMinutes} min average — patients may leave` });
  } else if (avgWaitMinutes > 30) {
    score -= 10;
    factors.push({ label: 'Moderate wait time', impact: 'negative', detail: `${avgWaitMinutes} min average wait` });
  } else if (avgWaitMinutes > 0) {
    factors.push({ label: 'Short wait time', impact: 'positive', detail: `${avgWaitMinutes} min average — patients are happy` });
  }

  // Factor 3: Staff utilization (too idle is also inefficient)
  const utilization = serving.length / Math.max(1, clinic.staffCount);
  if (utilization < 0.3 && waiting.length === 0) {
    factors.push({ label: 'Low demand period', impact: 'positive', detail: 'Staff have capacity for walk-ins' });
  } else if (utilization > 0.9) {
    factors.push({ label: 'Staff at full capacity', impact: 'negative', detail: 'Consider adding staff if this continues' });
    score -= 8;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const status: QueueHealth['status'] =
    score >= 80 ? 'excellent' : score >= 55 ? 'good' : score >= 30 ? 'strained' : 'critical';

  return { score, status, factors };
}
