import React, { startTransition, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { RecipeRequestBody } from '../../types/api';
import ErrorMessage from '../components/ErrorMessage';
import IngredientScanPanel from '../components/IngredientScanPanel';
import LoadingIndicator from '../components/LoadingIndicator';
import ModeSelector from '../components/ModeSelector';
import { useLiveIngredientScan } from '../hooks/useLiveIngredientScan';
import { requestRecipe } from '../hooks/useRecipeRequest';
import { useAuth } from '../context/AuthContext';

const PLACEHOLDERS: Record<string, string> = {
  suggestion: 'Please enter a recipe suggestion or idea: steak and mashed potatoes',
  import: 'Please enter a URL link: http://mashedpotatoes.com',
  ingredients: 'Please enter a comma-separated ingredients list: ribeye, potatoes, salt'
};

const MainPage = () => {
  const navigate = useNavigate();
  const { session: authSession } = useAuth();
  const [selectedMode, setSelectedMode] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const {
    isScanning,
    detectedIngredients,
    confirmedIngredients,
    scanError,
    setConfirmedIngredients,
    startScan,
    stopScan,
    finalizeIngredients,
    resetScanState,
    videoRef,
    canvasRef
  } = useLiveIngredientScan();

  const trimmedInput = inputValue.trim();
  const placeholderText = selectedMode ? PLACEHOLDERS[selectedMode] : 'Choose a mode first';
  const hasConfirmedCameraIngredients =
    selectedMode === 'ingredients' && confirmedIngredients.some((ingredient) => ingredient.trim());
  const hasInputForSubmit = hasConfirmedCameraIngredients || Boolean(trimmedInput);
  const isSubmitDisabled = !selectedMode || !hasInputForSubmit || isLoading || isScanning;

  const inlineValidationMessage = (() => {
    if (!selectedMode) {
      return 'Please select a mode to continue.';
    }

    if (!hasInputForSubmit) {
      return 'Please provide input before submitting.';
    }

    if (selectedMode === 'import') {
      try {
        const parsed = new URL(trimmedInput);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return 'Please enter a valid URL (http or https).';
        }
      } catch (_error) {
        return 'Please enter a valid URL (http or https).';
      }
    }

    return '';
  })();

  useEffect(() => {
    if (selectedMode === 'ingredients') {
      setInputValue(confirmedIngredients.filter(Boolean).join(', '));
    }
  }, [confirmedIngredients, selectedMode]);

  const handleModeSelect = (mode: string) => {
    setSelectedMode(mode);
    setInputValue('');
    setErrorMessage('');
    resetScanState();
  };

  const handleStartScan = async () => {
    try {
      setErrorMessage('');
      await startScan();
    } catch (_error) {
      setErrorMessage('Camera access failed. Please allow camera permission and try again.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSubmitDisabled) {
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const cleanedConfirmedIngredients = confirmedIngredients
        .map((ingredient) => ingredient.trim())
        .filter(Boolean);
      const usingCameraIngredients =
        selectedMode === 'ingredients' && cleanedConfirmedIngredients.length > 0;

      if (usingCameraIngredients) {
        finalizeIngredients(cleanedConfirmedIngredients);
      }

      const recipe = await requestRecipe({
        mode: selectedMode as RecipeRequestBody['mode'],
        inputValue: trimmedInput,
        inputMethod: usingCameraIngredients ? 'camera_live' : undefined,
        ingredientsList: usingCameraIngredients ? cleanedConfirmedIngredients : undefined
      }, authSession?.access_token);

      startTransition(() => {
        navigate('/your-recipe', {
          state: {
            recipe
          }
        });
      });
    } catch (error) {
      setErrorMessage((error as Error).message || 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container">
      <h1>How would you like to cook today?</h1>

      <form onSubmit={handleSubmit} className="recipe-form">
        <ModeSelector
          selectedMode={selectedMode}
          onSelect={handleModeSelect}
          disabled={isLoading || isScanning}
        />

        <div className="input-with-action">
          <input
            type="text"
            className="shared-input"
            value={inputValue}
            placeholder={placeholderText}
            onChange={(event) => setInputValue(event.target.value)}
            disabled={isLoading || isScanning}
          />

          {selectedMode === 'ingredients' && (
            <button
              type="button"
              className="camera-button"
              onClick={handleStartScan}
              disabled={isLoading || isScanning}
              aria-label="Start live camera scan"
            >
              <svg viewBox="0 0 24 24" className="camera-icon" aria-hidden="true">
                <path
                  d="M8 6h2.2l1.1-1.7h1.4L13.8 6H16c1.7 0 3 1.3 3 3v6c0 1.7-1.3 3-3 3H8c-1.7 0-3-1.3-3-3V9c0-1.7 1.3-3 3-3Zm4 3.2A3.8 3.8 0 1 0 12 17a3.8 3.8 0 0 0 0-7.8Zm0 1.8a2 2 0 1 1 0 4.1 2 2 0 0 1 0-4.1Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}
        </div>

        {selectedMode === 'ingredients' && (
          <IngredientScanPanel
            isScanning={isScanning}
            detectedIngredients={detectedIngredients}
            confirmedIngredients={confirmedIngredients}
            setConfirmedIngredients={setConfirmedIngredients}
            onStopScan={stopScan}
            scanError={scanError}
            videoRef={videoRef}
            canvasRef={canvasRef}
          />
        )}

        {inlineValidationMessage && <ErrorMessage message={inlineValidationMessage} />}

        <button type="submit" className="submit-button" disabled={isSubmitDisabled}>
          Submit
        </button>

        {isLoading && <LoadingIndicator />}

        {errorMessage && <ErrorMessage message={errorMessage} />}
      </form>

      <Link to="/past-recipes" className="back-link">
        View Past Recipes
      </Link>
    </main>
  );
};

export default MainPage;
