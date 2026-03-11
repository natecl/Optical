const {
  InMemorySessionService,
  LlmAgent,
  Runner,
  isFinalResponse,
  stringifyContent
} = require('@google/adk');

const BOOTSTRAP_APP_NAME = 'CookMate';
const RUNNER_APP_NAME = 'Cookmate';
const USER_ID = 'user_1';
const SESSION_ID = 'recipe_session_1';

let runtimePromise;

const createRuntime = async () => {
  const sessionService = new InMemorySessionService();

  const nanabot = new LlmAgent({
    name: 'nanabot',
    model: 'gemini-2.5-flash-lite',
    instruction: [
      'You are a recipe assistant.',
      'Return JSON only with exactly these keys: recipe_name, ingredients, instructions.',
      'recipe_name must be a string.',
      'ingredients must be an array of strings.',
      'instructions must be an array of strings.'
    ].join(' ')
  });

  await sessionService.createSession({
    appName: BOOTSTRAP_APP_NAME,
    userId: USER_ID,
    sessionId: SESSION_ID,
    state: { topic: 'recipes' }
  });

  await sessionService.getOrCreateSession({
    appName: RUNNER_APP_NAME,
    userId: USER_ID,
    sessionId: SESSION_ID,
    state: { topic: 'recipes' }
  });

  const runner = new Runner({
    agent: nanabot,
    appName: RUNNER_APP_NAME,
    sessionService
  });

  return { runner };
};

const getRuntime = async () => {
  if (!runtimePromise) {
    runtimePromise = createRuntime();
  }
  return runtimePromise;
};

const extractJsonString = (text) => {
  const trimmed = text.trim();

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
};

const normalizeRecipeResponse = (responseText) => {
  const rawJson = extractJsonString(responseText);
  const parsed = JSON.parse(rawJson);

  const instructionsValue = Array.isArray(parsed.instructions)
    ? parsed.instructions
    : typeof parsed.instructions === 'string'
      ? parsed.instructions.split(/\n|\. /g)
      : [];

  if (
    typeof parsed.recipe_name !== 'string' ||
    !Array.isArray(parsed.ingredients) ||
    !Array.isArray(instructionsValue)
  ) {
    throw new Error('Agent response is missing required recipe fields');
  }

  const ingredients = parsed.ingredients.filter((item) => typeof item === 'string');
  const instructions = instructionsValue
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  if (ingredients.length === 0 || instructions.length === 0) {
    throw new Error('Agent response includes no valid ingredients');
  }

  return {
    recipe_name: parsed.recipe_name.trim(),
    ingredients,
    instructions
  };
};

const generateRecipeFromPrompt = async (prompt) => {
  const { runner } = await getRuntime();

  const newMessage = {
    role: 'user',
    parts: [
      {
        text: `${prompt}\nReturn JSON only with recipe_name, ingredients, instructions.`
      }
    ]
  };

  const events = runner.runAsync({
    userId: USER_ID,
    sessionId: SESSION_ID,
    newMessage
  });

  let finalResponseText = '';
  for await (const event of events) {
    if (isFinalResponse(event)) {
      finalResponseText = stringifyContent(event).trim();
    }
  }

  if (!finalResponseText) {
    throw new Error('Agent returned no final response text');
  }

  return normalizeRecipeResponse(finalResponseText);
};

module.exports = {
  generateRecipeFromPrompt
};
