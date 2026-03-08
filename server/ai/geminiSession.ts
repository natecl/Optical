/**
 * Module: geminiSession
 * 
 * Description:
 *   Manages the direct integration and API calls to the Google Gemini multimodal model.
 *   This includes instantiating the Gemini client, formatting multimodal payloads 
 *   (e.g., combining images with text), and streaming the AI's response text back.
 */

interface ChatTurn {
    role: "user" | "assistant";
    text: string;
}

export class GeminiSession {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    }

    /**
     * Prompts the multimodal model with a request
     * @param frame - Base64 or Blob representing the current image frame.
     * @param query - The user's question or transcribed speech.
     * @param context - Previous conversation turns.
     */
    async generateExplanation(frame: unknown, query: string, context: Record<string, unknown> | null) {
        void frame;
        const prompt = this.buildPromptFromContext(query, context);
        return this.generateText(prompt);
    }

    async generateChatReply(prompt: string, history: ChatTurn[]) {
        const historyText = history
            .slice(-8)
            .map((turn) => `${turn.role === "assistant" ? "Assistant" : "User"}: ${turn.text}`)
            .join("\n");
        const fullPrompt = historyText
            ? `Conversation history:\n${historyText}\n\nLatest user message:\n${prompt}`
            : prompt;

        return this.generateText(fullPrompt);
    }

    private buildPromptFromContext(query: string, context: Record<string, unknown> | null): string {
        if (!context) {
            return query;
        }

        const compactContext = JSON.stringify(context);
        return `Context: ${compactContext}\n\nQuestion: ${query}`;
    }

    private async generateText(prompt: string): Promise<string> {
        if (!this.apiKey) {
            return "Missing GEMINI_API_KEY. Add it to your environment before testing Gemini responses.";
        }

        const endpoint =
            process.env.GEMINI_API_URL ||
            `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 512,
                },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini request failed (${response.status}): ${errorBody}`);
        }

        const data = (await response.json()) as {
            candidates?: Array<{
                content?: {
                    parts?: Array<{ text?: string }>;
                };
            }>;
        };

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return text || "Gemini returned an empty response.";
    }
}
