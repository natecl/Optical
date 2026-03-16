import {
  InMemorySessionService,
  LlmAgent,
  Runner,
  isFinalResponse,
  stringifyContent
} from '@google/adk';
import crypto from 'crypto';
import type { Recipe } from '../../../types/recipe';

const RUNNER_APP_NAME = 'Cookmate';

const extractJsonString = (text: string): string => {
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

const normalizeRecipeResponse = (responseText: string): Recipe => {
  const rawJson = extractJsonString(responseText);
  const parsed = JSON.parse(rawJson);

  const instructionsValue: string[] = Array.isArray(parsed.instructions)
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

  const ingredients = parsed.ingredients.filter((item: unknown) => typeof item === 'string');
  const instructions = instructionsValue
    .filter((item: unknown) => typeof item === 'string')
    .map((item: string) => item.trim())
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

export const generateRecipeFromPrompt = async (prompt: string): Promise<Recipe> => {
  const sessionService = new InMemorySessionService();
  const userId = `user_${crypto.randomUUID()}`;
  const sessionId = `recipe_${crypto.randomUUID()}`;

  const nanaBot = new LlmAgent({
    name: 'nanaBot',
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
    appName: RUNNER_APP_NAME,
    userId,
    sessionId,
    state: { topic: 'recipes' }
  });

  const runner = new Runner({
    agent: nanaBot,
    appName: RUNNER_APP_NAME,
    sessionService
  });

  const newMessage = {
    role: 'user',
    parts: [
      {
        text: `${prompt}\nReturn JSON only with recipe_name, ingredients, instructions.`
      }
    ]
  };

  const events = runner.runAsync({
    userId,
    sessionId,
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
