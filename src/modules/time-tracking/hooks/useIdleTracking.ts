import { useEffect, useRef, useCallback } from 'react';
import { useTimeDeskStore } from '../timeDeskStore';
import { useTimeDeskSettingsStore } from '../timeDeskSettingsStore';
import { toast } from 'sonner';

export function useIdleTracking() {
  const { activeSession, activeBreak, startBreak } = useTimeDeskStore();
  const { workSettings } = useTimeDeskSettingsStore();
  const workerRef = useRef<Worker | null>(null);

  // If auto-idle tracking is disabled or settings not loaded, default to 15 mins
  const maxIdleTimeMinutes = workSettings?.auto_break_idle_minutes || 15;
  const isEnabled = workSettings?.enable_auto_idle_tracking ?? true;

  const resetTimer = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'RESET' });
    }
  }, []);

  useEffect(() => {
    // Only track idle time if the user is clocked in and NOT already on a break
    if (!isEnabled || !activeSession || activeBreak) {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP' });
      }
      return;
    }

    // Initialize Web Worker for unthrottled background tracking
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../../../lib/workers/idleWorker.ts', import.meta.url), { type: 'module' });
      
      workerRef.current.onmessage = async (e) => {
        if (e.data.type === 'IDLE_TIMEOUT') {
          // The worker detected inactivity!
          try {
            toast.warning(`You have been idle for ${maxIdleTimeMinutes} minutes. Auto-starting break.`);
            await startBreak('short_break');
          } catch (err) {
            console.error("Failed to auto-start break:", err);
          }
        }
      };
    }

    workerRef.current.postMessage({ 
      type: 'START', 
      maxIdleTime: maxIdleTimeMinutes * 60 * 1000 
    });

    // Attach event listeners to document to detect user activity
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    // Throttle the reset slightly so we don't spam postMessage on every single mousemove pixel
    let lastReset = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastReset > 1000) { // only send RESET once per second max
        resetTimer();
        lastReset = now;
      }
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP' });
      }
    };
  }, [activeSession, activeBreak, isEnabled, maxIdleTimeMinutes, resetTimer, startBreak]);

  return null;
}
