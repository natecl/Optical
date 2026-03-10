const RECIPE_URL = 'http://localhost:5000/api/recipe';

export const fetchRecipe = async (dish) => {
  const response = await fetch(RECIPE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ dish })
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorPayload = await response.json();
      if (errorPayload?.message) {
        message = errorPayload.message;
      }
    } catch (_error) {
      // Keep fallback message when response body is not JSON.
    }
    throw new Error(message);
  }

  return response.json();
};
