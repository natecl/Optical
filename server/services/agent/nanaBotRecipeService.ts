import { GoogleGenAI } from '@google/genai';
import type { Recipe } from '../../../types/recipe';

const MODEL = 'gemini-2.5-flash-lite';

const SYSTEM_INSTRUCTION = [
  'You are a recipe assistant.',
  'Return JSON only with exactly these keys: recipe_name, ingredients, instructions.',
  'recipe_name must be a string.',
  'ingredients must be an array of strings (e.g. "2 cups flour"), not objects.',
  'instructions must be an array of strings.',
  'Do not wrap the JSON in markdown code fences.'
].join(' ');

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

const stringifyIngredient = (item: unknown): string | null => {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    const parts = [obj.quantity, obj.item ?? obj.name, obj.notes]
      .filter((v) => typeof v === 'string' && v.trim())
      .map((v) => (v as string).trim());
    return parts.length > 0 ? parts.join(' - ') : null;
  }
  return null;
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

  const ingredients = parsed.ingredients
    .map(stringifyIngredient)
    .filter((v): v is string => v !== null);
  const instructions = instructionsValue
    .filter((item: unknown) => typeof item === 'string')
    .map((item: string) => item.trim())
    .filter(Boolean);

  if (ingredients.length === 0 || instructions.length === 0) {
    throw new Error('Agent response includes no valid ingredients or instructions');
  }

  return {
    recipe_name: parsed.recipe_name.trim(),
    ingredients,
    instructions
  };
};

export const generateRecipeFromPrompt = async (prompt: string): Promise<Recipe> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_GENAI_API_KEY is required');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `${prompt}\nReturn JSON only with recipe_name, ingredients, instructions.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
    },
  });

  const responseText = response.text?.trim();
  if (!responseText) {
    throw new Error('Model returned no response text');
  }

  return normalizeRecipeResponse(responseText);
};
