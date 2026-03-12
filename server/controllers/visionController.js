const { detectIngredientsFromImage } = require('../services/vision/ingredientVisionService');

const postVisionIngredients = async (req, res) => {
  try {
    const { image } = req.body || {};
    const ingredients = await detectIngredientsFromImage(image);
    res.status(200).json({ ingredients });
  } catch (_error) {
    res.status(500).json({ error: 'Ingredient detection failed' });
  }
};

module.exports = {
  postVisionIngredients
};
