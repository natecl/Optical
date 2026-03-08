/**
 * Module: agentController
 * 
 * Description:
 *   The brain of the Optical backend application. Orchestrates the flow of data:
 *   Receives raw media from `websocketServer`, updates internal `state`, calls 
 *   `geminiSession` to get insights, and passes the result back to the user.
 */

import { GeminiSession } from './geminiSession';

interface ChatTurn {
    role: "user" | "assistant";
    text: string;
}

export class AgentController {
    private session: GeminiSession;

    constructor() {
        this.session = new GeminiSession(process.env.GEMINI_API_KEY || '');
    }

    /**
     * Handles an incoming user request from the UI
     */
    async processInteraction(frameData: unknown, transcribedText: string, convoState: Record<string, unknown> | null) {
        try {
            // 1. Scene Interpretation
            // 2. Query execution via Gemini
            const response = await this.session.generateExplanation(frameData, transcribedText, convoState);

            // 3. Format and return
            return { msg: response, status: 'success' };
        } catch (e) {
            console.error("Error in AgentController:", e);
            return { msg: "Sorry, an error occurred.", status: 'error' };
        }
    }

    async processChatPrompt(prompt: string, history: ChatTurn[]) {
        try {
            const response = await this.session.generateChatReply(prompt, history);
            return { msg: response, status: "success" };
        } catch (e) {
            console.error("Error in AgentController chat flow:", e);
            return { msg: "Sorry, an error occurred.", status: "error" };
        }
    }
}
