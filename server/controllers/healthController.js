const { processRecipeRequest, RecipeRequestError } = require('../services/recipeService');

const postRecipe = async (req, res) => {
  try {
    const recipe = await processRecipeRequest(req.body);
    res.status(200).json(recipe);
  } catch (error) {
    if (error instanceof RecipeRequestError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Recipe generation failed' });
  }
};

module.exports = {
  postRecipe
};
