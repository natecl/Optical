import { generateRecipeFromPrompt } from './agent/nanaBotRecipeService';
import { normalizeIngredientList } from '../utils/ingredientNormalization';
import { RecipeRequestError } from '../../types/errors';
import type { Recipe } from '../../types/recipe';
import type { RecipeRequestBody } from '../../types/api';
import dns from 'dns/promises';
import net from 'net';

const BLOCKED_IP_RANGES = [
  /^127\./,                    // loopback
  /^10\./,                     // private class A
  /^172\.(1[6-9]|2\d|3[01])\./, // private class B
  /^192\.168\./,               // private class C
  /^169\.254\./,               // link-local / cloud metadata
  /^0\./,                      // current network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // carrier-grade NAT
  /^::1$/,                     // IPv6 loopback
  /^f[cd]/i,                   // IPv6 unique local
  /^fe80/i,                    // IPv6 link-local
];

const BLOCKED_HOSTNAMES = ['metadata.google.internal', 'metadata.internal'];

const isBlockedIp = (ip: string): boolean =>
  BLOCKED_IP_RANGES.some((pattern) => pattern.test(ip));

const validateUrlTarget = async (hostname: string): Promise<void> => {
  if (BLOCKED_HOSTNAMES.includes(hostname.toLowerCase())) {
    throw new RecipeRequestError('URL target is not allowed', 400);
  }
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new RecipeRequestError('URL target is not allowed', 400);
    }
    return;
  }
  const addresses = await dns.resolve4(hostname).catch(() => [] as string[]);
  const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[]);
  const allAddresses = [...addresses, ...addresses6];
  if (allAddresses.length === 0) {
    throw new RecipeRequestError('Could not resolve URL hostname', 400);
  }
  if (allAddresses.every(isBlockedIp)) {
    throw new RecipeRequestError('URL target is not allowed', 400);
  }
};

const ALLOWED_MODES = new Set(['suggestion', 'import', 'ingredients']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseIngredientCsv = (csv: string): string[] =>
  normalizeIngredientList(
    csv
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );

const stripHtml = (html: string): string =>
  html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractTitle = (html: string): string => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || '';
};

const extractSection = (text: string, startTokens: string[], endTokens: string[]): string => {
  const start = `(?:${startTokens.join('|')})`;
  const end = `(?:${endTokens.join('|')})`;
  const pattern = new RegExp(`${start}[\\s:\\-]*([\\s\\S]{20,2500}?)(?:${end}|$)`, 'i');
  const match = text.match(pattern);
  return match?.[1]?.trim() || '';
};

const toLines = (sectionText: string, maxItems: number): string[] => {
  if (!sectionText) {
    return [];
  }

  return sectionText
    .split(/\n|•|\*|;|\./g)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
};

interface ExtractedRecipeContext {
  title: string;
  ingredients: string[];
  instructions: string[];
  rawTextSnippet: string;
}

const extractRecipeContextFromHtml = (html: string): ExtractedRecipeContext => {
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

const buildPromptForSuggestion = (suggestion: string): string => `Create a recipe for ${suggestion}`;

const buildPromptForIngredients = (ingredients: string[]): string =>
  [
    'Create one recipe from this ingredient list.',
    `Ingredients available: ${ingredients.join(', ')}.`,
    'Only include realistic extra pantry staples if absolutely necessary.'
  ].join(' ');

const buildPromptForImport = ({ link, extracted }: { link: string; extracted: ExtractedRecipeContext }): string =>
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

const validateBodyShape = (body: unknown): { mode: RecipeRequestBody['mode']; data: RecipeRequestBody['data'] } => {
  if (!isObject(body)) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  const { mode, data } = body as Record<string, unknown>;
  if (typeof mode !== 'string' || !isObject(data)) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  if (!ALLOWED_MODES.has(mode)) {
    throw new RecipeRequestError('Invalid mode', 400);
  }

  return { mode: mode as RecipeRequestBody['mode'], data: data as RecipeRequestBody['data'] };
};

const preprocessSuggestion = (data: RecipeRequestBody['data']): string => {
  if (typeof data.suggestion !== 'string' || !data.suggestion.trim()) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  return buildPromptForSuggestion(data.suggestion.trim());
};

const preprocessIngredients = (data: RecipeRequestBody['data']): string => {
  let ingredients: string[] = [];

  if (typeof data.ingredients === 'string' && data.ingredients.trim()) {
    ingredients = parseIngredientCsv(data.ingredients);
  } else if (Array.isArray(data.ingredients)) {
    ingredients = normalizeIngredientList(data.ingredients);
  } else {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  if (ingredients.length === 0) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  return buildPromptForIngredients(ingredients);
};

const preprocessImport = async (data: RecipeRequestBody['data']): Promise<string> => {
  if (typeof data.link !== 'string' || !data.link.trim()) {
    throw new RecipeRequestError('Invalid request body', 400);
  }

  const link = data.link.trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(link);
  } catch (_error) {
    throw new RecipeRequestError('Invalid recipe URL', 400);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new RecipeRequestError('Invalid recipe URL', 400);
  }

  await validateUrlTarget(parsedUrl.hostname);

  let html: string;
  try {
    const response = await fetch(link, { redirect: 'error' });
    if (!response.ok) {
      throw new Error(`Failed to fetch recipe page with status ${response.status}`);
    }
    html = await response.text();
  } catch (error) {
    throw new RecipeRequestError((error as Error).message || 'Recipe generation failed', 500);
  }

  const extracted = extractRecipeContextFromHtml(html);
  return buildPromptForImport({ link, extracted });
};

const buildAgentPrompt = async ({ mode, data }: { mode: RecipeRequestBody['mode']; data: RecipeRequestBody['data'] }): Promise<string> => {
  if (mode === 'suggestion') {
    return preprocessSuggestion(data);
  }

  if (mode === 'import') {
    return preprocessImport(data);
  }

  return preprocessIngredients(data);
};

export const processRecipeRequest = async (body: unknown): Promise<Recipe> => {
  const { mode, data } = validateBodyShape(body);
  const prompt = await buildAgentPrompt({ mode, data });

  try {
    return await generateRecipeFromPrompt(prompt);
  } catch (_error) {
    throw new RecipeRequestError('Recipe generation failed', 500);
  }
};

export { RecipeRequestError };
