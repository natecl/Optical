const { generateRecipeFromPrompt } = require('./agent/nanabotService');

const ALLOWED_MODES = new Set(['suggestion', 'import', 'ingredients']);

class RecipeRequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'RecipeRequestError';
    this.status = status;
  }
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const parseIngredientCsv = (csv) =>
  csv
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const stripHtml = (html) =>
  html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractTitle = (html) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || '';
};

const extractSection = (text, startTokens, endTokens) => {
  const start = `(?:${startTokens.join('|')})`;
  const end = `(?:${endTokens.join('|')})`;
  const pattern = new RegExp(`${start}[\\s:\\-]*([\\s\\S]{20,2500}?)(?:${end}|$)`, 'i');
  const match = text.match(pattern);
  return match?.[1]?.trim() || '';
};

const toLines = (sectionText, maxItems) => {
  if (!sectionText) {
    return [];
  }

  return sectionText
    .split(/\n|•|\*|;|\./g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
};

const extractRecipeContextFromHtml = (html) => {
  const normalizedHtml = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n');
  const text = stripHtml(normalizedHtml);
  const title = extractTitle(html);

  const ingredientsSection = extractSection(
    text,
    ['ingredients?'],
    ['instructions?', 'directions?', 'method', 'steps?']
  );

  const instructionsSection = extractSection(
    text,
    ['instructions?', 'directions?', 'method', 'steps?'],
    ['nutrition', 'notes?', 'serves?', 'comments?']
  );

  return {
    title,
    ingredients: toLines(ingredientsSection, 20),
    instructions: toLines(instructionsSection, 20),
    rawTextSnippet: text.slice(0, 5000)
  };
};

const buildPromptForSuggestion = (suggestion) => `Create a recipe for ${suggestion}`;

const buildPromptForIngredients = (ingredients) =>
  [
    'Create one recipe from this ingredient list.',
    `Ingredients available: ${ingredients.join(', ')}.`,
    'Only include realistic extra pantry staples if absolutely necessary.'
  ].join(' ');

const buildPromptForImport = ({ link, extracted }) =>
  [
    'Structure this imported recipe content into JSON recipe output.',
    `Source URL: ${link}`,
    extracted.title ? `Page title: ${extracted.title}` : 'Page title: not found',
    extracted.ingredients.length
      ? `Extracted ingredients: ${extracted.ingredients.join(' | ')}`
      : 'Extracted ingredients: not found',
    extracted.instructions.length
      ? `Extracted instructions: ${extracted.instructions.join(' | ')}`
      : 'Extracted instructions: not found',
    `Additional page text snippet: ${extracted.rawTextSnippet}`,
    'If any fields are missing, infer minimally and keep the recipe coherent.'
  ].join('\n');

const validateBodyShape = (body) => {
  if (!isObject(body)) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  const { mode, data } = body;
  if (typeof mode !== 'string' || !isObject(data)) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  if (!ALLOWED_MODES.has(mode)) {
    throw new RecipeRequestError('Invalid mode', 400);
  }

  return { mode, data };
};

const preprocessSuggestion = (data) => {
  if (typeof data.suggestion !== 'string' || !data.suggestion.trim()) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  return buildPromptForSuggestion(data.suggestion.trim());
};

const preprocessIngredients = (data) => {
  if (typeof data.ingredients !== 'string' || !data.ingredients.trim()) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  const ingredients = parseIngredientCsv(data.ingredients);
  if (ingredients.length === 0) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  return buildPromptForIngredients(ingredients);
};

const preprocessImport = async (data) => {
  if (typeof data.link !== 'string' || !data.link.trim()) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  const link = data.link.trim();
  let parsedUrl;
  try {
    parsedUrl = new URL(link);
  } catch (_error) {
    throw new RecipeRequestError('Invalid recipe URL', 400);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new RecipeRequestError('Invalid recipe URL', 400);
  }

  let html;
  try {
    const response = await fetch(link);
    if (!response.ok) {
      throw new Error(`Failed to fetch recipe page with status ${response.status}`);
    }
    html = await response.text();
  } catch (error) {
    throw new RecipeRequestError(error.message || 'Recipe generation failed', 500);
  }

  const extracted = extractRecipeContextFromHtml(html);
  return buildPromptForImport({ link, extracted });
};

const buildAgentPrompt = async ({ mode, data }) => {
  if (mode === 'suggestion') {
    return preprocessSuggestion(data);
  }

  if (mode === 'import') {
    return preprocessImport(data);
  }

  return preprocessIngredients(data);
};

const processRecipeRequest = async (body) => {
  const { mode, data } = validateBodyShape(body);
  const prompt = await buildAgentPrompt({ mode, data });

  try {
    return await generateRecipeFromPrompt(prompt);
  } catch (_error) {
    throw new RecipeRequestError('Recipe generation failed', 500);
  }
};

module.exports = {
  processRecipeRequest,
  RecipeRequestError
};
