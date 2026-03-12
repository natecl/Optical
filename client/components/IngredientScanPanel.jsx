import React from 'react';
import ErrorMessage from './ErrorMessage.jsx';

const IngredientScanPanel = ({
  isScanning,
  detectedIngredients,
  confirmedIngredients,
  setConfirmedIngredients,
  onStopScan,
  scanError,
  videoRef,
  canvasRef
}) => {
  const updateIngredient = (index, value) => {
    setConfirmedIngredients(
      confirmedIngredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? value : ingredient
      )
    );
  };

  const removeIngredient = (index) => {
    setConfirmedIngredients(
      confirmedIngredients.filter((_, ingredientIndex) => ingredientIndex !== index)
    );
  };

  const addIngredient = () => {
    setConfirmedIngredients([...confirmedIngredients, '']);
  };

  return (
    <section className="scan-panel">
      {isScanning && (
        <div className="camera-shell">
          <div className="camera-preview-wrap">
            <video
              ref={videoRef}
              className="camera-preview"
              autoPlay
              playsInline
              muted
            />
            <div className="scan-overlay-list">
              {[...detectedIngredients].map((ingredient) => (
                <span key={ingredient.name} className="scan-overlay-item">
                  {ingredient.name}
                </span>
              ))}
            </div>
          </div>
          <canvas ref={canvasRef} className="scan-canvas" />
          <button type="button" className="secondary-button" onClick={onStopScan}>
            Stop Scan
          </button>
        </div>
      )}

      {!isScanning && confirmedIngredients.length > 0 && (
        <div className="ingredient-editor">
          <p className="editor-title">Finalized ingredients</p>
          {confirmedIngredients.map((ingredient, index) => (
            <div key={`${index}-${ingredient}`} className="ingredient-editor-row">
              <input
                type="text"
                className="ingredient-chip-input"
                value={ingredient}
                onChange={(event) => updateIngredient(index, event.target.value)}
              />
              <button
                type="button"
                className="ingredient-remove-button"
                onClick={() => removeIngredient(index)}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="secondary-button" onClick={addIngredient}>
            Add ingredient
          </button>
        </div>
      )}

      {scanError && <ErrorMessage message={scanError} />}
    </section>
  );
};

export default IngredientScanPanel;
