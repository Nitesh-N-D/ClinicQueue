import { Clinic, Patient, WaitPrediction } from '../shared/types';
import { config } from '../config';

// Rolling window of recent service times per clinic (in-memory)
const serviceTimeHistory = new Map<string, number[]>(); // clinicId → array of ms durations

const MAX_HISTORY = 20; // use last 20 completions for prediction

export function recordServiceCompletion(clinicId: string, servedAt: number, completedAt: number): void {
  const durationMs = completedAt - servedAt;
  if (durationMs <= 0 || durationMs > 60 * 60 * 1000) return; // ignore > 1 hr (data error)

  if (!serviceTimeHistory.has(clinicId)) {
    serviceTimeHistory.set(clinicId, []);
  }
  const history = serviceTimeHistory.get(clinicId)!;
  history.push(durationMs);
  if (history.length > MAX_HISTORY) history.shift();
}

export function getAvgServiceMinutes(clinicId: string, dbAvg: number): number {
  const history = serviceTimeHistory.get(clinicId);
  if (!history || history.length < 3) {
    return dbAvg || config.BASE_SERVICE_MINUTES;
  }
  const avgMs = history.reduce((a, b) => a + b, 0) / history.length;
  return Math.max(1, Math.round(avgMs / 60_000));
}

export function predictWait(
  position: number, // 1-based position in waiting queue
  clinic: Clinic,
  activeQueue: Patient[]
): WaitPrediction {
  const staffCount = Math.max(1, clinic.staffCount);
  const avgServiceMin = getAvgServiceMinutes(clinic.id, clinic.avgServiceMinutes);

  // Count patients currently being served
  const servingCount = activeQueue.filter(p => p.status === 'serving').length;
  const waitingAhead = position - 1; // patients ahead in waiting

  // Each staff member serves one patient at a time
  // Slots available from current serving finishing + new slots
  const effectiveStaff = staffCount;

  // Simple queuing model: batched slot filling
  const slotsToWait = Math.ceil(waitingAhead / effectiveStaff);
  const baseWait = slotsToWait * avgServiceMin;

  // Correction: if some staff are idle, reduce wait
  const idleStaff = Math.max(0, effectiveStaff - servingCount);
  const idleReduction = idleStaff > 0 && waitingAhead < idleStaff ? 0 : 0;

  const estimatedMinutes = Math.max(0, baseWait - idleReduction);

  // Confidence based on history size
  const historySize = serviceTimeHistory.get(clinic.id)?.length ?? 0;
  const confidence: WaitPrediction['confidence'] =
    historySize >= 10 ? 'high' : historySize >= 4 ? 'medium' : 'low';

  return {
    estimatedMinutes,
    confidence,
    basedOn: historySize >= 3
      ? `Last ${historySize} patient times (avg ${avgServiceMin} min)`
      : `Default estimate (${avgServiceMin} min/patient)`,
  };
}

export function enrichQueueWithPositions(
  queue: Patient[],
  clinic: Clinic
): Patient[] {
  const waiting = queue.filter(p => p.status === 'waiting');
  const calling = queue.filter(p => p.status === 'called');
  const serving = queue.filter(p => p.status === 'serving');

  let position = 1;
  const enriched: Patient[] = [];

  // Called patients: position 0 (their turn now)
  for (const p of calling) {
    enriched.push({ ...p, position: 0, estimatedWaitMinutes: 0 });
  }

  // Serving patients: also position 0
  for (const p of serving) {
    enriched.push({ ...p, position: 0, estimatedWaitMinutes: 0 });
  }

  // Waiting patients: assign positions 1..N
  for (const p of waiting) {
    const prediction = predictWait(position, clinic, queue);
    enriched.push({
      ...p,
      position,
      estimatedWaitMinutes: prediction.estimatedMinutes,
    });
    position++;
  }

  return enriched;
}
