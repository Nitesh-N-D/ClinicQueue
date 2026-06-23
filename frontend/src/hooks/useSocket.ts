import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Patient, Clinic, QueueStats, QueueHealth, EnrichedPatient } from '../shared/types';

const SERVER = import.meta.env.VITE_SERVER_URL ?? '';

export interface PublicUpdate {
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

export interface StaffUpdate {
  clinic: Clinic;
  queue: EnrichedPatient[];
  done: Patient[];
  stats: QueueStats;
  health: QueueHealth | null;
}


// ─── Staff socket hook ────────────────────────────────────────────────────────

export function useStaffSocket(clinicId: string, credential: { pin?: string; accessToken?: string }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<StaffUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId || (!credential.pin && !credential.accessToken)) return;

    const socket = io(SERVER, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      socket.emit('staff:join', { clinicId, pin: credential.pin, accessToken: credential.accessToken });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('queue:full_update', (data: StaffUpdate) => {
      setState(data);
    });

    socket.on('error', (err: { message: string }) => {
      setError(err.message);
    });

    socket.on('connect_error', () => {
      setError('Connection failed — retrying...');
    });

    return () => { socket.disconnect(); };
  }, [clinicId, credential.pin, credential.accessToken]);

  const callNext = useCallback(() => {
    socketRef.current?.emit('staff:call_next', { clinicId });
  }, [clinicId]);

  const markServing = useCallback((patientId: string) => {
    socketRef.current?.emit('staff:mark_serving', { clinicId, patientId });
  }, [clinicId]);

  const markDone = useCallback((patientId: string) => {
    socketRef.current?.emit('staff:mark_done', { clinicId, patientId });
  }, [clinicId]);

  const markNoShow = useCallback((patientId: string) => {
    socketRef.current?.emit('staff:mark_no_show', { clinicId, patientId });
  }, [clinicId]);

  const updateStaffCount = useCallback((count: number) => {
    socketRef.current?.emit('staff:update_count', { clinicId, count });
  }, [clinicId]);

  const toggleOpen = useCallback((isOpen: boolean) => {
    socketRef.current?.emit('staff:toggle_open', { clinicId, isOpen });
  }, [clinicId]);

  return { connected, state, error, callNext, markServing, markDone, markNoShow, updateStaffCount, toggleOpen };
}

// ─── Patient-facing socket hook ───────────────────────────────────────────────

export function usePatientSocket(clinicId: string, patientId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [update, setUpdate] = useState<PublicUpdate | null>(null);

  useEffect(() => {
    if (!clinicId) return;

    const socket = io(SERVER, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('patient:watch', { clinicId, patientId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('queue:public_update', (data: PublicUpdate) => {
      setUpdate(data);
    });

    return () => { socket.disconnect(); };
  }, [clinicId, patientId]);

  return { connected, update };
}
