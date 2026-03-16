import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import type { Recipe } from '../../types/recipe';
import { useCookingSession } from '../hooks/useCookingSession';
import { useCookingCamera } from '../hooks/useCookingCamera';
import { useRamseyBot } from '../hooks/useRamseyBot';
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
  const { state } = useLocation();
  const navigate = useNavigate();
  const recipe = (state as { recipe?: Recipe } | null)?.recipe;
  const {
    session,
    loading,
    error,
    createSession,
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
    isConnected: ramseyConnected,
    isModelSpeaking,
    audioLevel,
    isPaused,
    audioBlocked,
    error: ramseyError,
    stepIllustration,
    clarifyIllustration,
    illustrationLoading,
    startVoiceSession,
    stopVoiceSession,
    togglePause,
    unlockAudio,
    dismissClarifyIllustration,
    clearStepIllustration,
  } = useRamseyBot();

  useEffect(() => {
    if (!recipe) return;

    let cancelled = false;

    const init = async () => {
      const created = await createSession(recipe);
      if (cancelled || !created) return;

      const started = await startCooking(created.sessionId);
      if (cancelled) return;

      await startCamera();
      if (cancelled) return;

      // Auto-start RamseyBot after cooking session and camera are ready
      if (started) {
        startVoiceSession(created.sessionId, videoRef);
      }
    };
    init();

    return () => {
      cancelled = true;
      stopTracks();
      stopVoiceSession();
    };
  }, []);

  // Clear step illustration when navigating to a new step (skip initial render)
  const currentIndex = session?.currentStepIndex ?? 0;
  const prevIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      clearStepIllustration();
      prevIndexRef.current = currentIndex;
    }
  }, [currentIndex, clearStepIllustration]);

  if (!recipe) {
    return (
      <main className="container">
        <p>No recipe loaded. Please generate a recipe first.</p>
        <Link to="/" className="back-link">Back to home</Link>
      </main>
    );
  }

  const instructions = session?.recipe?.instructions || recipe.instructions || [];
  const stepCompletion = session?.stepCompletion || [];
  const totalSteps = instructions.length;
  const currentStepText = instructions[currentIndex] || '';
  const isFirstStep = currentIndex === 0;
  const allComplete = stepCompletion.length > 0 && stepCompletion.every(Boolean);

  const handleCompleteStep = async () => {
    if (stepCompletion[currentIndex]) {
      await nextStep();
      return;
    }
    await completeStep();
  };

  const handleFinish = async () => {
    stopVoiceSession();
    await finishSession();
    stopTracks();
    navigate('/your-recipe', { state: { recipe } });
  };

  const displayError = error || cameraError || ramseyError;

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

        {ramseyConnected && (
          <div className="ramsey-status">
            <span className="ramsey-indicator" />
            RamseyBot
          </div>
        )}

        {clarifyIllustration && (
          <div
            className="clarify-overlay"
            onClick={dismissClarifyIllustration}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && dismissClarifyIllustration()}
          >
            <img
              src={`data:image/${clarifyIllustration.format};base64,${clarifyIllustration.image}`}
              alt={clarifyIllustration.alt}
              className="clarify-overlay-image"
            />
            <span className="clarify-overlay-dismiss">Tap to dismiss</span>
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
          {(stepIllustration || illustrationLoading) && (
            <div className="instruction-illustration">
              {illustrationLoading && !stepIllustration ? (
                <div className="illustration-loading">
                  <span className="illustration-spinner" />
                  <span>Generating illustration...</span>
                </div>
              ) : stepIllustration ? (
                <img
                  src={`data:image/${stepIllustration.format};base64,${stepIllustration.image}`}
                  alt={stepIllustration.alt}
                  className="illustration-image"
                />
              ) : null}
            </div>
          )}

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
            onClick={previousStep}
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
