import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useCookingSession } from '../hooks/useCookingSession.js';
import { useCookingCamera } from '../hooks/useCookingCamera.js';
import { useRamseyBot } from '../hooks/useRamseyBot.js';
import ErrorMessage from '../components/ErrorMessage.jsx';

const VoiceWave = ({ audioLevel, isModelSpeaking }) => {
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
            }}
          />
        );
      })}
    </div>
  );
};

const CookingPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const recipe = state?.recipe;
  const initRef = useRef(false);

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
    isMuted,
    error: ramseyError,
    startVoiceSession,
    stopVoiceSession,
    toggleMute,
  } = useRamseyBot();

  useEffect(() => {
    if (!recipe || initRef.current) return;
    initRef.current = true;

    const init = async () => {
      const created = await createSession(recipe);
      if (created) {
        const started = await startCooking(created.sessionId);
        await startCamera();
        // Auto-start RamseyBot after cooking session and camera are ready
        if (started) {
          startVoiceSession(created.sessionId, videoRef);
        }
      }
    };
    init();

    return () => {
      stopTracks();
      stopVoiceSession();
    };
  }, []);

  if (!recipe) {
    return (
      <main className="container">
        <p>No recipe loaded. Please generate a recipe first.</p>
        <Link to="/" className="back-link">Back to home</Link>
      </main>
    );
  }

  const instructions = session?.recipe?.instructions || recipe.instructions || [];
  const currentIndex = session?.currentStepIndex ?? 0;
  const stepCompletion = session?.stepCompletion || [];
  const totalSteps = instructions.length;
  const currentStepText = instructions[currentIndex] || '';
  const isFirstStep = currentIndex === 0;
  const allComplete = stepCompletion.length > 0 && stepCompletion.every(Boolean);

  const handleCompleteStep = async () => {
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
        <p className="step-text">{currentStepText}</p>

        <VoiceWave audioLevel={audioLevel} isModelSpeaking={isModelSpeaking} />

        <div className="cooking-controls">
          <button
            type="button"
            className="secondary-button"
            onClick={previousStep}
            disabled={isFirstStep || loading}
          >
            Previous
          </button>

          <button
            type="button"
            className={`mic-toggle-button${isMuted ? ' mic-muted' : ''}`}
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? 'Unmute' : 'Mute'}
          </button>

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
              disabled={loading || stepCompletion[currentIndex]}
            >
              {stepCompletion[currentIndex] ? 'Completed' : 'Complete Step'}
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
