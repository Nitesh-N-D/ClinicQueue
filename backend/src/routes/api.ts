import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import * as qm from '../services/queueManager';
import { handleIncomingSMS } from '../services/smsService';
import { Language, AppointmentType } from '../shared/types';
import * as dbHelper from '../db/supabase';
import { requireGoogleStaffAuth, requireAdmin, AuthedRequest } from '../middleware/auth';
import * as authService from '../services/authService';

const router = Router();

// Rate limiting for public join endpoint
const joinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  max: 10,
  message: { error: 'Too many requests. Please wait and try again.' },
});

const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
});

// ─── Health ───────────────────────────────────────────────────────────────────

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ─── Clinics ──────────────────────────────────────────────────────────────────

router.get('/clinics', async (_req, res) => {
  const clinics = await dbHelper.getAllClinics();
  res.json(clinics);
});

router.get('/clinics/:clinicId', async (req, res) => {
  const state = qm.getState(req.params.clinicId);
  if (!state) return res.status(404).json({ error: 'Clinic not found' });
  res.json({
    clinic: state.clinic,
    stats: qm.getStats(req.params.clinicId),
    isOpen: state.clinic.isOpen,
  });
});

// ─── Queue (public) ───────────────────────────────────────────────────────────

// Get queue state (public — for patient-facing display)
router.get('/clinics/:clinicId/queue', (req, res) => {
  const state = qm.getState(req.params.clinicId);
  if (!state) return res.status(404).json({ error: 'Clinic not found' });

  // For public view: only show limited info (position, wait, ticket number — no phone)
  const publicQueue = state.queue
    .filter(p => ['waiting', 'called', 'serving'].includes(p.status))
    .map(p => ({
      ticketNumber: p.ticketNumber,
      status: p.status,
      position: p.position,
      estimatedWaitMinutes: p.estimatedWaitMinutes,
      type: p.type,
    }));

  res.json({
    queue: publicQueue,
    stats: qm.getStats(req.params.clinicId),
    clinic: {
      name: state.clinic.name,
      isOpen: state.clinic.isOpen,
      staffCount: state.clinic.staffCount,
    },
    health: qm.getQueueHealth(req.params.clinicId),
  });
});

// Join queue (public — rate limited)
router.post('/clinics/:clinicId/queue/join', joinLimiter, async (req, res) => {
  const { clinicId } = req.params;
  const { name, phone, language, type, reason } = req.body as {
    name: string;
    phone: string;
    language: Language;
    type: AppointmentType;
    reason: string;
  };

  // Validation
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!phone?.trim()) return res.status(400).json({ error: 'Phone number is required' });
  const phoneClean = phone.replace(/\D/g, '');
  if (phoneClean.length < 10) return res.status(400).json({ error: 'Valid phone number required' });

  const validLanguages: Language[] = ['en', 'es', 'hi', 'ta', 'fr'];
  const lang: Language = validLanguages.includes(language) ? language : 'en';
  const apptType: AppointmentType = type === 'appointment' ? 'appointment' : 'walk_in';

  const result = await qm.addToQueue(clinicId, {
    name: name.trim(),
    phone: phoneClean,
    language: lang,
    type: apptType,
    reason: (reason ?? '').trim(),
  });

  if ('error' in result) return res.status(400).json(result);
  res.status(201).json(result);
});

// Check status by phone (patient self-service)
router.get('/clinics/:clinicId/queue/status', async (req, res) => {
  const { clinicId } = req.params;
  const { phone } = req.query as { phone: string };

  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const patient = await qm.getStatusByPhone(clinicId, phone.replace(/\D/g, ''));
  if (!patient) return res.status(404).json({ error: 'Not found in current queue' });

  res.json({
    ticketNumber: patient.ticketNumber,
    status: patient.status,
    position: patient.position,
    estimatedWaitMinutes: patient.estimatedWaitMinutes,
    name: patient.name,
  });
});

// ─── Staff actions (Google OAuth primary, PIN fallback) ───────────────────────

const STAFF_PIN = process.env.STAFF_PIN ?? '1234';

// Both auth paths set req.staffMember OR allow a valid PIN through.
// req.staffMember is undefined when PIN-only auth is used (legacy mode).
function verifyStaff(req: AuthedRequest, res: Response): boolean {
  // Already verified by requireGoogleStaffAuth middleware
  if (req.staffMember) return true;

  // Fall back to legacy PIN if no Google session was presented
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    const pin = req.headers['x-staff-pin'] ?? req.body?.pin;
    if (pin === STAFF_PIN) return true;
  }

  res.status(401).json({ error: 'Sign in with Google or enter the staff PIN' });
  return false;
}

// Apply Google auth resolution to every /staff route — it's a no-op if no
// Bearer token is present, so PIN-only clients are unaffected.
router.use('/clinics/:clinicId/staff', requireGoogleStaffAuth);

// ─── Staff team management ────────────────────────────────────────────────────

// List staff members + pending invites for a clinic (admin only)
router.get('/clinics/:clinicId/staff/team', async (req: AuthedRequest, res) => {
  if (!verifyStaff(req, res)) return;
  const members = await authService.listStaffMembers(req.params.clinicId);
  const invites = await authService.listPendingInvites(req.params.clinicId);
  res.json({ members, invites, currentUser: req.staffMember ?? null });
});

// Invite a new staff member by email (admin only, or any staff if clinic has none yet)
router.post('/clinics/:clinicId/staff/invite', async (req: AuthedRequest, res) => {
  if (!verifyStaff(req, res)) return;
  const { email, role } = req.body as { email: string; role?: 'admin' | 'staff' };
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  // If using PIN-only mode (no Google identity yet), allow the first invite
  // to bootstrap an admin without requiring an existing admin.
  const existingMembers = await authService.listStaffMembers(req.params.clinicId);
  if (req.staffMember && req.staffMember.role !== 'admin' && existingMembers.length > 0) {
    return res.status(403).json({ error: 'Only admins can invite staff' });
  }

  const ok = await authService.inviteStaffMember(
    req.params.clinicId,
    email.toLowerCase().trim(),
    role === 'admin' ? 'admin' : 'staff',
    req.staffMember?.userId ?? '00000000-0000-0000-0000-000000000000'
  );
  if (!ok) return res.status(500).json({ error: 'Failed to send invite' });
  res.json({ success: true });
});

// Remove a staff member (admin only)
router.delete('/clinics/:clinicId/staff/team/:staffMemberId', async (req: AuthedRequest, res) => {
  if (!verifyStaff(req, res)) return;
  if (req.staffMember && req.staffMember.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can remove staff' });
  }
  const ok = await authService.removeStaffMember(req.params.clinicId, req.params.staffMemberId);
  res.json({ success: ok });
});

// Revoke a pending invite
router.delete('/clinics/:clinicId/staff/invite/:email', async (req: AuthedRequest, res) => {
  if (!verifyStaff(req, res)) return;
  const ok = await authService.revokeInvite(req.params.clinicId, req.params.email);
  res.json({ success: ok });
});

// Check current session / "who am I" — used by frontend to verify on load
router.get('/clinics/:clinicId/staff/me', async (req: AuthedRequest, res) => {
  if (!verifyStaff(req, res)) return;
  res.json({ staffMember: req.staffMember ?? null, authMethod: req.staffMember ? 'google' : 'pin' });
});

// Call next patient
router.post('/clinics/:clinicId/staff/call-next', async (req, res) => {
  if (!verifyStaff(req, res)) return;
  const result = await qm.callNext(req.params.clinicId);
  if ('error' in result) return res.status(400).json(result);
  res.json(result);
});

// Mark patient as being served
router.post('/clinics/:clinicId/staff/serving/:patientId', async (req, res) => {
  if (!verifyStaff(req, res)) return;
  const result = await qm.markServing(req.params.clinicId, req.params.patientId);
  if ('error' in result) return res.status(400).json(result);
  res.json(result);
});

// Mark patient as done
router.post('/clinics/:clinicId/staff/done/:patientId', async (req, res) => {
  if (!verifyStaff(req, res)) return;
  const result = await qm.markDone(req.params.clinicId, req.params.patientId);
  if ('error' in result) return res.status(400).json(result);
  res.json(result);
});

// Mark no-show
router.post('/clinics/:clinicId/staff/no-show/:patientId', async (req, res) => {
  if (!verifyStaff(req, res)) return;
  const result = await qm.markNoShow(req.params.clinicId, req.params.patientId);
  if ('error' in result) return res.status(400).json(result);
  res.json(result);
});

// Update staff count
router.post('/clinics/:clinicId/staff/count', async (req, res) => {
  if (!verifyStaff(req, res)) return;
  const { count } = req.body as { count: number };
  if (!count || count < 1) return res.status(400).json({ error: 'Count must be >= 1' });
  await qm.updateStaff(req.params.clinicId, count);
  res.json({ success: true, staffCount: count });
});

// Toggle clinic open/closed
router.post('/clinics/:clinicId/staff/toggle-open', async (req, res) => {
  if (!verifyStaff(req, res)) return;
  const { isOpen } = req.body as { isOpen: boolean };
  await qm.toggleOpen(req.params.clinicId, isOpen);
  res.json({ success: true, isOpen });
});

// Get full staff view (with patient details)
router.get('/clinics/:clinicId/staff/queue', (req, res) => {
  if (!verifyStaff(req, res)) return;
  const state = qm.getState(req.params.clinicId);
  if (!state) return res.status(404).json({ error: 'Clinic not found' });
  res.json({
    clinic: state.clinic,
    queue: qm.getEnrichedQueue(req.params.clinicId),
    done: state.done.slice(0, 20),
    stats: qm.getStats(req.params.clinicId),
    health: qm.getQueueHealth(req.params.clinicId),
  });
});

// Queue health score (standalone endpoint)
router.get('/clinics/:clinicId/staff/health', (req, res) => {
  if (!verifyStaff(req, res)) return;
  const health = qm.getQueueHealth(req.params.clinicId);
  if (!health) return res.status(404).json({ error: 'Clinic not found' });
  res.json(health);
});

// ─── Twilio SMS webhook ───────────────────────────────────────────────────────

router.post('/sms/incoming', smsLimiter, async (req, res) => {
  const { From, Body } = req.body as { From: string; Body: string };
  const clinicId = (req.query.clinicId as string) ?? 'a0000000-0000-0000-0000-000000000001';

  // Always respond with TwiML
  res.set('Content-Type', 'text/xml');

  const intent = await handleIncomingSMS(From, Body, clinicId);
  const phone = From.replace(/\D/g, '');

  if (intent === 'STATUS_REQUEST') {
    const patient = await qm.getStatusByPhone(clinicId, phone);
    if (!patient) {
      res.send(`<?xml version="1.0"?><Response><Message>You are not in our current queue. Visit our clinic or text JOIN to sign up.</Message></Response>`);
    } else {
      const msg = patient.status === 'waiting'
        ? `You are #${patient.position} in queue. Est. wait: ${patient.estimatedWaitMinutes} min.`
        : patient.status === 'called'
        ? `It's your turn! Please come to reception now. Ticket #${patient.ticketNumber}.`
        : `You are currently being served. Ticket #${patient.ticketNumber}.`;
      res.send(`<?xml version="1.0"?><Response><Message>${msg}</Message></Response>`);
    }
  } else if (intent === 'LEAVE_REQUEST') {
    const patient = await qm.getStatusByPhone(clinicId, phone);
    if (patient && patient.status === 'waiting') {
      await qm.markNoShow(clinicId, patient.id);
      res.send(`<?xml version="1.0"?><Response><Message>You have been removed from the queue. We hope to see you soon.</Message></Response>`);
    } else {
      res.send(`<?xml version="1.0"?><Response><Message>You are not in an active queue.</Message></Response>`);
    }
  } else {
    res.send(`<?xml version="1.0"?><Response><Message>ClinicQueue: Reply HELP for your queue status, or LEAVE to exit the queue.</Message></Response>`);
  }
});

export default router;
