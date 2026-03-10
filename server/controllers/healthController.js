const postRecipe = (req, res) => {
  const { dish } = req.body || {};
  const normalizedDish = typeof dish === 'string' ? dish.trim().toLowerCase() : '';

  if (!normalizedDish) {
    res.status(400).json({
      status: 'failed',
      message: 'dish is required'
    });
    return;
  }

  res.status(200).json({
    'recipe name': `${normalizedDish} and rice`,
    ingredients: [normalizedDish, 'rice'],
    instructions: `cook the ${normalizedDish} and rice`
  });
};

module.exports = {
  postRecipe
};
