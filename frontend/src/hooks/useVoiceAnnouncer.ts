import { useEffect, useRef, useCallback, useState } from 'react';

interface CalledPatient {
  ticketNumber: number;
}

// Announces newly-called ticket numbers aloud using the browser's built-in
// speech synthesis — completely free, works offline, no API key required.
export function useVoiceAnnouncer(calledTickets: number[]) {
  const announced = useRef<Set<number>>(new Set());
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('speechSynthesis' in window);
  }, []);

  const announce = useCallback((ticketNumber: number) => {
    if (!enabled || !supported) return;
    const utterance = new SpeechSynthesisUtterance(
      `Ticket number ${ticketNumber}, please proceed to reception.`
    );
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }, [enabled, supported]);

  useEffect(() => {
    for (const ticket of calledTickets) {
      if (!announced.current.has(ticket)) {
        announced.current.add(ticket);
        announce(ticket);
      }
    }
  }, [calledTickets, announce]);

  const toggle = useCallback(() => {
    setEnabled(e => {
      const next = !e;
      if (next) {
        // Trigger a silent test utterance to unlock audio on user gesture
        const test = new SpeechSynthesisUtterance(' ');
        test.volume = 0;
        window.speechSynthesis.speak(test);
      }
      return next;
    });
  }, []);

  return { enabled, supported, toggle };
}
