const RECIPE_URL = 'http://localhost:5000/api/recipe';

const buildRequestBody = ({ mode, inputValue }) => {
  if (mode === 'suggestion') {
    return {
      mode,
      data: { suggestion: inputValue }
    };
  }

  if (mode === 'import') {
    return {
      mode,
      data: { link: inputValue }
    };
  }

  return {
    mode,
    data: { ingredients: inputValue }
  };
};

export const requestRecipe = async ({ mode, inputValue }) => {
  const response = await fetch(RECIPE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildRequestBody({ mode, inputValue }))
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const backendMessage = payload?.error || payload?.message;
    throw new Error(backendMessage || 'Recipe request failed');
  }

  return payload;
};
