const { GoogleGenAI } = require('@google/genai');
const {
  normalizeIngredientList,
  normalizeIngredientName
} = require('../../utils/ingredientNormalization');

const MODEL_NAME = 'gemini-2.5-flash-lite';
const PROMPT = [
  'Identify food ingredients visible in the image.',
  'Return a JSON array of ingredient names.',
  'Do not include utensils, packaging, plates, or kitchen tools.'
].join(' ');

let client;

const getClient = () => {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Vision API key is missing');
    }

    client = new GoogleGenAI({ apiKey });
  }

  return client;
};

const extractJsonArray = (rawText) => {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1);
  }

  return trimmed;
};

const parseImageInput = (imageInput) => {
  if (typeof imageInput !== 'string' || !imageInput.trim()) {
    throw new Error('Image is required');
  }

  const trimmed = imageInput.trim();
  const dataUrlMatch = trimmed.match(/^data:(image\/jpeg|image\/jpg);base64,(.+)$/i);
  if (dataUrlMatch) {
    return {
      mimeType: 'image/jpeg',
      data: dataUrlMatch[2]
    };
  }

  return {
    mimeType: 'image/jpeg',
    data: trimmed
  };
};

const detectIngredientsFromImage = async (imageInput) => {
  const { mimeType, data } = parseImageInput(imageInput);
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT },
          {
            inlineData: {
              mimeType,
              data
            }
          }
        ]
      }
    ]
  });

  const rawText = response.text || '';
  const parsed = JSON.parse(extractJsonArray(rawText));

  if (!Array.isArray(parsed)) {
    throw new Error('Vision API returned invalid ingredient output');
  }

  return normalizeIngredientList(parsed.map(normalizeIngredientName));
};

module.exports = {
  detectIngredientsFromImage
};
