const { GoogleGenAI, Modality } = require('@google/genai');

const MODEL = 'gemini-live-2.5-flash-native-audio';

function buildSystemInstruction(recipe, currentStepIndex) {
  const ingredientsList = recipe.ingredients
    .map((ing, i) => `${i + 1}. ${ing}`)
    .join('\n');

  const instructionsList = recipe.instructions
    .map((step, i) => `Step ${i + 1}: ${step}`)
    .join('\n');

  return `You are RamseyBot, a warm and knowledgeable cooking guide. You are helping the user cook the following recipe:

Recipe: ${recipe.recipe_name}

Ingredients:
${ingredientsList}

Instructions:
${instructionsList}

The user is currently on Step ${currentStepIndex + 1}.

Your role:
- Read the current step aloud when the user starts or moves to a new step
- Watch the camera feed to observe the user's cooking progress
- If you notice something wrong (burning, wrong technique, missed ingredient), gently alert the user
- Answer any questions about the recipe, techniques, substitutions, or timing
- If the user wants to alter or pivot from the recipe, help them adapt
- Keep responses conversational and encouraging
- When the user completes a step, confirm and guide them to the next one
- Use clear, concise language — the user's hands are busy cooking

Start by greeting the user and reading Step ${currentStepIndex + 1} aloud.`;
}

async function createLiveSession(recipe, currentStepIndex, callbacks) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_GENAI_API_KEY is required');
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = buildSystemInstruction(recipe, currentStepIndex);

  const session = await ai.live.connect({
    model: MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction,
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
    callbacks: {
      onopen: () => {
        if (callbacks.onReady) callbacks.onReady();
      },
      onmessage: (message) => {
        if (callbacks.onMessage) callbacks.onMessage(message);
      },
      onerror: (error) => {
        if (callbacks.onError) callbacks.onError(error);
      },
      onclose: (event) => {
        if (callbacks.onClose) callbacks.onClose(event);
      },
    },
  });

  return session;
}

module.exports = {
  createLiveSession,
};
