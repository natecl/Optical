import React from 'react';

const MODE_OPTIONS = [
  { key: 'suggestion', label: 'Suggestion' },
  { key: 'import', label: 'URL Link' },
  { key: 'ingredients', label: 'Ingredients List' }
];

const ModeSelector = ({ selectedMode, onSelect, disabled }) => (
  <div className="mode-selector" role="group" aria-label="Recipe modes">
    {MODE_OPTIONS.map((option) => (
      <button
        key={option.key}
        type="button"
        className={`mode-button ${selectedMode === option.key ? 'is-selected' : ''}`}
        onClick={() => onSelect(option.key)}
        disabled={disabled}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default ModeSelector;
