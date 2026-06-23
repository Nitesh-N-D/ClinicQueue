import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRouter from './routes/api';
import { config, isDev } from './config';
import * as qm from './services/queueManager';
import { verifyAccessToken, resolveStaffAccess } from './services/authService';

const app = express();
const httpServer = createServer(app);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [config.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-staff-pin',
  ],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // needed for Twilio webhook
if (isDev) app.use(morgan('dev'));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api', apiRouter);
app.get('/', (_req, res) => res.json({ service: 'ClinicQueue API', version: '1.0.0' }));

// ─── Socket.io ────────────────────────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: {
    origin: [config.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Staff joins a clinic room — accepts EITHER a Google access token OR a PIN
  socket.on('staff:join', async (data: { clinicId: string; pin?: string; accessToken?: string }) => {
    let authorized = false;
    let staffName: string | undefined;

    if (data.accessToken) {
      const user = await verifyAccessToken(data.accessToken);
      if (user) {
        const staffMember = await resolveStaffAccess(data.clinicId, user);
        if (staffMember) {
          authorized = true;
          staffName = staffMember.name ?? staffMember.email;
        }
      }
    }

    if (!authorized && data.pin) {
      authorized = data.pin === (process.env.STAFF_PIN ?? '1234');
    }

    if (!authorized) {
      socket.emit('error', { message: 'Sign in with Google or enter a valid staff PIN' });
      return;
    }

    socket.join(`clinic:${data.clinicId}:staff`);
    socket.join(`clinic:${data.clinicId}`);
    const state = qm.getState(data.clinicId);
    if (state) {
      socket.emit('queue:full_update', {
        clinic: state.clinic,
        queue: qm.getEnrichedQueue(data.clinicId),
        done: state.done.slice(0, 20),
        stats: qm.getStats(data.clinicId),
        health: qm.getQueueHealth(data.clinicId),
      });
    }
    console.log(`Staff socket joined clinic ${data.clinicId}${staffName ? ` as ${staffName}` : ' (PIN)'}`);
  });

  // Patient joins to watch their position
  socket.on('patient:watch', (data: { clinicId: string; patientId?: string }) => {
    socket.join(`clinic:${data.clinicId}`);
    if (data.patientId) {
      socket.join(`patient:${data.patientId}`);
    }
    // Send current public queue state
    const state = qm.getState(data.clinicId);
    if (state) {
      socket.emit('queue:public_update', {
        queue: state.queue
          .filter(p => ['waiting', 'called', 'serving'].includes(p.status))
          .map(p => ({
            ticketNumber: p.ticketNumber,
            status: p.status,
            position: p.position,
            estimatedWaitMinutes: p.estimatedWaitMinutes,
            type: p.type,
          })),
        stats: qm.getStats(data.clinicId),
        clinic: { name: state.clinic.name, isOpen: state.clinic.isOpen },
      });
    }
  });

  // Staff action via socket (alternative to REST)
  socket.on('staff:call_next', async (data: { clinicId: string }) => {
    const result = await qm.callNext(data.clinicId);
    if ('error' in result) {
      socket.emit('action:error', result);
      return;
    }
    broadcastUpdate(data.clinicId);
  });

  socket.on('staff:mark_serving', async (data: { clinicId: string; patientId: string }) => {
    const result = await qm.markServing(data.clinicId, data.patientId);
    if ('error' in result) { socket.emit('action:error', result); return; }
    broadcastUpdate(data.clinicId);
  });

  socket.on('staff:mark_done', async (data: { clinicId: string; patientId: string }) => {
    const result = await qm.markDone(data.clinicId, data.patientId);
    if ('error' in result) { socket.emit('action:error', result); return; }
    broadcastUpdate(data.clinicId);
  });

  socket.on('staff:mark_no_show', async (data: { clinicId: string; patientId: string }) => {
    const result = await qm.markNoShow(data.clinicId, data.patientId);
    if ('error' in result) { socket.emit('action:error', result); return; }
    broadcastUpdate(data.clinicId);
  });

  socket.on('staff:update_count', async (data: { clinicId: string; count: number }) => {
    await qm.updateStaff(data.clinicId, data.count);
    broadcastUpdate(data.clinicId);
  });

  socket.on('staff:toggle_open', async (data: { clinicId: string; isOpen: boolean }) => {
    await qm.toggleOpen(data.clinicId, data.isOpen);
    broadcastUpdate(data.clinicId);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Broadcast to all in clinic room
export function broadcastUpdate(clinicId: string): void {
  const state = qm.getState(clinicId);
  if (!state) return;

  const stats = qm.getStats(clinicId);
  const health = qm.getQueueHealth(clinicId);
  const enrichedQueue = qm.getEnrichedQueue(clinicId);

  // Full update to staff
  io.to(`clinic:${clinicId}:staff`).emit('queue:full_update', {
    clinic: state.clinic,
    queue: enrichedQueue,
    done: state.done.slice(0, 20),
    stats,
    health,
  });

  // Public update to patients
  io.to(`clinic:${clinicId}`).emit('queue:public_update', {
    queue: state.queue
      .filter(p => ['waiting', 'called', 'serving'].includes(p.status))
      .map(p => ({
        ticketNumber: p.ticketNumber,
        status: p.status,
        position: p.position,
        estimatedWaitMinutes: p.estimatedWaitMinutes,
        type: p.type,
      })),
    stats,
    clinic: { name: state.clinic.name, isOpen: state.clinic.isOpen },
  });
}

// Make broadcastUpdate available to routes
app.set('broadcastUpdate', broadcastUpdate);

// ─── Patch routes to emit socket events after mutations ───────────────────────
// The REST routes above update state — we need to broadcast after each one.
// We do this by monkey-patching the response to detect success and broadcast.
// Simple approach: poll state every 1 second and emit if changed.
let lastUpdateTime = 0;
setInterval(() => {
  for (const clinicId of qm.getAllClinicIds()) {
    const state = qm.getState(clinicId);
    if (state && state.lastUpdated > lastUpdateTime) {
      lastUpdateTime = state.lastUpdated;
      broadcastUpdate(clinicId);
    }
  }
}, 1000);

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  // Load default clinic from env or use demo
  const clinicId = process.env.DEFAULT_CLINIC_ID ?? 'a0000000-0000-0000-0000-000000000001';
  console.log(`\n🏥 ClinicQueue starting...`);

  const state = await qm.initClinic(clinicId);
  if (!state) {
    console.warn(`⚠️  Could not load clinic ${clinicId} — make sure schema.sql has been run in Supabase`);
  }

  httpServer.listen(config.PORT, () => {
    console.log(`\n✅ ClinicQueue API running on http://localhost:${config.PORT}`);
    console.log(`   Frontend expected at: ${config.FRONTEND_URL}`);
    console.log(`   SMS enabled: ${config.SMS_ENABLED}`);
    console.log(`   Staff PIN: ${process.env.STAFF_PIN ?? '1234'} (change STAFF_PIN env var)`);
    console.log(`\n   Endpoints:`);
    console.log(`   GET  /api/clinics/:id/queue       — public queue`);
    console.log(`   POST /api/clinics/:id/queue/join  — patient joins`);
    console.log(`   POST /api/clinics/:id/staff/call-next — staff actions`);
    console.log(`   POST /api/sms/incoming            — Twilio webhook\n`);
  });
}

boot().catch(err => {
  console.error('Boot failed:', err);
  process.exit(1);
});
