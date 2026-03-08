"use strict";
/**
 * Module: agentController
 *
 * Description:
 *   The brain of the Optical backend application. Orchestrates the flow of data:
 *   Receives raw media from `websocketServer`, updates internal `state`, calls
 *   `geminiSession` to get insights, and passes the result back to the user.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const geminiSession_1 = require("./geminiSession");
class AgentController {
    session;
    constructor() {
        this.session = new geminiSession_1.GeminiSession(process.env.GEMINI_API_KEY || '');
    }
    /**
     * Handles an incoming user request from the UI
     */
    async processInteraction(frameData, transcribedText, convoState) {
        try {
            // 1. Scene Interpretation
            // 2. Query execution via Gemini
            const response = await this.session.generateExplanation(frameData, transcribedText, convoState);
            // 3. Format and return
            return { msg: response, status: 'success' };
        }
        catch (e) {
            console.error("Error in AgentController:", e);
            return { msg: "Sorry, an error occurred.", status: 'error' };
        }
    }
}
exports.AgentController = AgentController;
