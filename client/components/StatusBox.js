export const renderStatusBox = ({ textarea, state, payload, error }) => {
  if (!textarea) {
    return;
  }

  if (state === 'loading') {
    textarea.value = 'loading';
    return;
  }

  if (state === 'success') {
    const recipeName = payload?.['recipe name'] || 'Unknown';
    const ingredients = Array.isArray(payload?.ingredients)
      ? payload.ingredients.join(', ')
      : 'Unknown';
    const instructions = payload?.instructions || 'Unknown';

    textarea.value = `recipe name: ${recipeName}\ningredients: ${ingredients}\ninstructions: ${instructions}`;
    return;
  }

  textarea.value = `status: failed\nmessage: ${error || 'frontend and backend are not connected properly'}`;
};
