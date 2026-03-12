const INGREDIENT_ALIASES = new Map([
  ['roma tomato', 'tomato'],
  ['roma tomatoes', 'tomato'],
  ['cherry tomato', 'tomato'],
  ['cherry tomatoes', 'tomato'],
  ['red tomato', 'tomato'],
  ['red tomatoes', 'tomato'],
  ['tomatoes', 'tomato'],
  ['red onion', 'onion'],
  ['yellow onion', 'onion'],
  ['white onion', 'onion']
]);

const normalizeIngredientName = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) {
    return '';
  }

  return INGREDIENT_ALIASES.get(normalized) || normalized;
};

const normalizeIngredientList = (ingredients) => {
  if (!Array.isArray(ingredients)) {
    return [];
  }

  return [...new Set(ingredients.map(normalizeIngredientName).filter(Boolean))];
};

module.exports = {
  normalizeIngredientList,
  normalizeIngredientName
};
