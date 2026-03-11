import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import ModeSelector from '../components/ModeSelector.jsx';
import { requestRecipe } from '../hooks/useRecipeRequest.js';

const PLACEHOLDERS = {
  suggestion: 'Please enter a recipe suggestion or idea: steak and mashed potatoes',
  import: 'Please enter a URL link: http://mashedpotatoes.com',
  ingredients: 'Please enter a comma-separated ingredients list: ribeye, potatoes, salt'
};

const MainPage = () => {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const trimmedInput = inputValue.trim();
  const placeholderText = selectedMode ? PLACEHOLDERS[selectedMode] : 'Choose a mode first';
  const isSubmitDisabled = !selectedMode || !trimmedInput || isLoading;

  const inlineValidationMessage = useMemo(() => {
    if (!selectedMode) {
      return 'Please select a mode to continue.';
    }

    if (!trimmedInput) {
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
  }, [selectedMode, trimmedInput]);

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
    setInputValue('');
    setErrorMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitDisabled) {
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const recipe = await requestRecipe({ mode: selectedMode, inputValue: trimmedInput });

      navigate('/your-recipe', {
        state: {
          recipe
        }
      });
    } catch (error) {
      setErrorMessage(error.message || 'Network error. Please try again.');
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
          disabled={isLoading}
        />

        <input
          type="text"
          className="shared-input"
          value={inputValue}
          placeholder={placeholderText}
          onChange={(event) => setInputValue(event.target.value)}
          disabled={isLoading}
        />

        {inlineValidationMessage && <ErrorMessage message={inlineValidationMessage} />}

        <button type="submit" className="submit-button" disabled={isSubmitDisabled}>
          Submit
        </button>

        {isLoading && <LoadingIndicator />}

        {errorMessage && <ErrorMessage message={errorMessage} />}
      </form>
    </main>
  );
};

export default MainPage;
