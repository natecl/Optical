import React from 'react';

const LoadingIndicator = () => (
  <div className="loading-wrap" aria-live="polite">
    <span className="loading-ring" aria-hidden="true" />
    <p className="loading-text">reading the recipe books</p>
  </div>
);

export default LoadingIndicator;
