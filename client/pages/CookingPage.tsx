import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import type { Recipe } from '../../types/recipe';
import { useCookingSession } from '../hooks/useCookingSession';
import { useCookingCamera } from '../hooks/useCookingCamera';
import { useNanaBot } from '../hooks/useNanaBot';
import {
  buildCookingPath,
  clearPersistedCookingSessionId,
  getResumableSessionId,
  persistCookingSessionId,
  readPersistedCookingSessionId,
  shouldResumeCookingSession,
} from '../hooks/useCookingSessionPersistence';
import ErrorMessage from '../components/ErrorMessage';

interface VoiceWaveProps {
  audioLevel: number;
  isModelSpeaking: boolean;
}

const VoiceWave = ({ audioLevel, isModelSpeaking }: VoiceWaveProps) => {
  const barCount = 5;
  return (
    <div className="voice-wave">
      {Array.from({ length: barCount }, (_, i) => {
        const delay = i * 0.08;
        const scale = isModelSpeaking
          ? 0.3 + Math.random() * 0.7
          : Math.max(0.15, audioLevel * (0.5 + Math.random() * 0.5));
        return (
          <span
            key={i}
            className={`voice-bar${isModelSpeaking ? ' voice-bar-model' : ''}`}
            style={{
              '--bar-scale': scale,
              '--bar-delay': `${delay}s`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
};

const CookingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const recipe = (location.state as { recipe?: Recipe } | null)?.recipe;
  const resumableSessionId = getResumableSessionId(location.search, readPersistedCookingSessionId());
  const shouldResumeSession = shouldResumeCookingSession(resumableSessionId, Boolean(recipe));
  const {
    session,
    loading,
    error,
    createSession,
    loadSession,
    startCooking,
    nextStep,
    previousStep,
    completeStep,
    finishSession
  } = useCookingSession();

  const {
    cameraError,
    videoRef,
    startCamera,
    stopTracks,
    toggleCamera
  } = useCookingCamera();

  const {
    isConnected: nanaConnected,
    isModelSpeaking,
    audioLevel,
    isPaused,
    audioBlocked,
    error: nanaError,
    startVoiceSession,
    stopVoiceSession,
    togglePause,
    unlockAudio,
    notifyStepChange: notifyBotStepChange,
  } = useNanaBot();

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) {
      return;
    }

    if (!recipe && !shouldResumeSession) {
      return;
    }

    initRef.current = true;
    let cancelled = false;

    const init = async () => {
      // Use existing session if available (e.g. React Strict Mode second run)
      let activeSession = session || (shouldResumeSession && resumableSessionId
        ? await loadSession(resumableSessionId)
        : await createSession(recipe as Recipe));
      if (cancelled || !activeSession) {
        initRef.current = false;
        if (shouldResumeSession) {
          clearPersistedCookingSessionId();
        }
        return;
      }

      persistCookingSessionId(activeSession.sessionId);

      const expectedPath = buildCookingPath(activeSession.sessionId);
      if (`${location.pathname}${location.search}` !== expectedPath) {
        window.history.replaceState(
          recipe ? { recipe } : null,
          '',
          expectedPath
        );
      }

      if (activeSession.status === 'idle') {
        const startedSession = await startCooking(activeSession.sessionId);
        if (cancelled || !startedSession) {
          initRef.current = false;
          return;
        }
        activeSession = startedSession;
      }

      if (activeSession.status === 'completed') {
        return;
      }

      await startCamera();
      if (cancelled) return;

      startVoiceSession(activeSession.sessionId, videoRef);
    };
    init();

    return () => {
      cancelled = true;
      initRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup camera and voice on unmount only
  useEffect(() => {
    return () => {
      stopTracks();
      stopVoiceSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentIndex = session?.currentStepIndex ?? 0;
  const activeRecipe = session?.recipe || recipe;

  if (!activeRecipe) {
    return (
      <main className="container">
        <p>{error || 'No recipe loaded. Please generate a recipe first.'}</p>
        <Link to="/" className="back-link">Back to home</Link>
      </main>
    );
  }

  const instructions = session?.recipe?.instructions || activeRecipe.instructions || [];
  const stepCompletion = session?.stepCompletion || [];
  const totalSteps = instructions.length;
  const currentStepText = instructions[currentIndex] || '';
  const isFirstStep = currentIndex === 0;
  const allComplete = stepCompletion.length > 0 && stepCompletion.every(Boolean);

  const handleCompleteStep = async () => {
    const nextIndex = currentIndex + 1;
    if (stepCompletion[currentIndex]) {
      // Interrupt voice and flush audio immediately, before awaiting the API
      notifyBotStepChange(nextIndex);
      await nextStep();
      return;
    }
    // Interrupt voice and flush audio immediately, before awaiting the API
    notifyBotStepChange(nextIndex);
    await completeStep();
  };

  const handleFinish = async () => {
    stopVoiceSession();
    await finishSession();
    clearPersistedCookingSessionId();
    stopTracks();
    navigate('/your-recipe', { state: { recipe: activeRecipe } });
  };

  const displayError = error || cameraError || nanaError;

  return (
    <main className="cooking-page">
      <div className="cooking-video-container">
        <video
          ref={videoRef}
          className="cooking-video"
          autoPlay
          playsInline
          muted
        />
        <button
          type="button"
          className="camera-toggle-button"
          onClick={toggleCamera}
          aria-label="Switch camera"
        >
          Flip
        </button>

        {nanaConnected && (
          <div className="nana-status">
            <span className="nana-indicator" />
            NanaBot
          </div>
        )}

      </div>

      <div className="step-progress">
        {instructions.map((_, index) => (
          <span
            key={index}
            className={`step-dot${index === currentIndex ? ' step-dot-active' : ''}${stepCompletion[index] ? ' step-dot-completed' : ''}`}
          />
        ))}
      </div>

      <div className="cooking-bottom-bar">
        <p className="step-label">
          Step {currentIndex + 1} of {totalSteps}
        </p>

        <div className="step-main-row">
          <div className="step-copy">
            <p className="step-text">{currentStepText}</p>
          </div>
        </div>

        {audioBlocked && (
          <button
            type="button"
            className="submit-button"
            onClick={unlockAudio}
            style={{ marginBottom: '0.5rem' }}
          >
            Tap to Enable Audio
          </button>
        )}

        <div className="cooking-controls">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              notifyBotStepChange(currentIndex - 1);
              previousStep();
            }}
            disabled={isFirstStep || loading}
          >
            Previous
          </button>

          <div className="voice-center-control">
            <VoiceWave audioLevel={audioLevel} isModelSpeaking={isModelSpeaking} />
            <button
              type="button"
              className={`mic-toggle-button${isPaused ? ' mic-muted' : ''}`}
              onClick={togglePause}
              aria-label={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
          </div>

          {allComplete ? (
            <button
              type="button"
              className="submit-button"
              onClick={handleFinish}
              disabled={loading}
            >
              Finish Cooking
            </button>
          ) : (
            <button
              type="button"
              className="submit-button"
              onClick={handleCompleteStep}
              disabled={loading}
            >
              {stepCompletion[currentIndex] ? 'Continue' : 'Complete Step'}
            </button>
          )}
        </div>
      </div>

      {displayError && (
        <ErrorMessage message={displayError} />
      )}
    </main>
  );
};

export default CookingPage;
