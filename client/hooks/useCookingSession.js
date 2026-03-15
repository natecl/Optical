import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:5000/api/cooking';

export const useCookingSession = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createSession = useCallback(async (recipe) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create session');
      setSession(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSession = useCallback(async (sessionId) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Session not found');
      setSession(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendEvent = useCallback(async (eventPayload, sessionIdOverride) => {
    const id = sessionIdOverride || session?.sessionId;
    if (!id) return null;
    setError('');
    try {
      const res = await fetch(`${API_BASE}/sessions/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Event failed');
      setSession(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [session?.sessionId]);

  const startCooking = useCallback((sessionId) => sendEvent({ type: 'START_COOKING' }, sessionId), [sendEvent]);
  const nextStep = useCallback(() => sendEvent({ type: 'NEXT_STEP' }), [sendEvent]);
  const previousStep = useCallback(() => sendEvent({ type: 'PREVIOUS_STEP' }), [sendEvent]);
  const completeStep = useCallback(() => sendEvent({ type: 'MARK_STEP_COMPLETE' }), [sendEvent]);
  const goToStep = useCallback((stepIndex) => sendEvent({ type: 'GO_TO_STEP', stepIndex }), [sendEvent]);
  const pauseSession = useCallback(() => sendEvent({ type: 'PAUSE_SESSION' }), [sendEvent]);
  const resumeSession = useCallback(() => sendEvent({ type: 'RESUME_SESSION' }), [sendEvent]);
  const finishSession = useCallback(() => sendEvent({ type: 'FINISH_SESSION' }), [sendEvent]);
  const resetSession = useCallback(() => sendEvent({ type: 'RESET_SESSION' }), [sendEvent]);

  return {
    session,
    loading,
    error,
    createSession,
    loadSession,
    sendEvent,
    startCooking,
    nextStep,
    previousStep,
    completeStep,
    goToStep,
    pauseSession,
    resumeSession,
    finishSession,
    resetSession
  };
};
