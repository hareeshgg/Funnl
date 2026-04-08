import { GeminiClient } from "../utils/gemini";
import logger from "../logger/logger";

/**
 * Hybrid Intelligence System utilizing Rules + LLM per Organization
 */
export class HybridEngine {
  private geminiClient: GeminiClient;
  private customPrompt: string | null;

  constructor(geminiClient: GeminiClient, customPrompt?: string | null) {
    this.geminiClient = geminiClient;
    this.customPrompt = customPrompt || null;
  }

  /**
   * Fast rule-based response for deterministic triggers
   * @param message User message text
   */
  async checkRules(message: string): Promise<string | null> {
    const text = message.toLowerCase();
    
    if (text.includes("price") || text.includes("how much")) {
      return "I'd love to share our pricing packages with you! Are you looking for individual or team options?";
    }
    
    if (text.includes("demo") || text.includes("book a call")) {
      return "Absolutely! You can book a demo directly through our calendar link here: [CAL LINK]. What time works best?";
    }

    if (text.includes("hi") || text.includes("hello") || text.includes("hey")) {
      return "Hi there! 👋 How can I help you today?";
    }

    return null;
  }

  /**
   * Get the best response using hybrid approach (Rules -> LLM)
   */
  async getResponse(history: any[], userInput: string, context: string = "social media interaction"): Promise<string> {
    // 1. Try deterministic rules
    const ruleResponse = await this.checkRules(userInput);
    if (ruleResponse) return ruleResponse;

    // 2. Fallback to Gemini
    return await this.geminiClient.generateReply(
      context, 
      userInput, 
      history, 
      this.customPrompt
    );
  }
}
