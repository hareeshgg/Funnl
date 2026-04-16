import { BaseProvider } from "./providers/BaseProvider";
import logger from "../logger/logger";

/**
 * Hybrid Intelligence System utilizing Rules + LLM per Organization
 */
export class HybridEngine {
  private provider: BaseProvider;
  private customPrompt: string | null;

  constructor(provider: BaseProvider, customPrompt?: string | null) {
    this.provider = provider;
    this.customPrompt = customPrompt || null;
  }

  /**
   * Fast rule-based response for deterministic triggers
   * @param message User message text
   */
  async checkRules(message: string): Promise<string | null> {
    const text = message.toLowerCase();

    // 1. Pricing Rules
    if (/\b(price|how much|pricing)\b/i.test(text)) {
      return "I'd love to share our pricing packages with you!";
    }

    // 2. Demo Rules
    if (/\b(demo|book a call|calendar)\b/i.test(text)) {
      return "Absolutely!";
    }

    // 3. Generic Greetings (The primary fix for broad matching)
    if (/\b(hi|hello|hey)\b/i.test(text)) {
      return "Hi!";
    }

    return null;
  }

  /**
   * Get the best response using hybrid approach (Rules -> LLM)
   */
  async getResponse(
    history: any[],
    userInput: string,
    context: string = "social media interaction",
  ): Promise<string> {
    // 1. Try deterministic rules
    const ruleResponse = await this.checkRules(userInput);
    if (ruleResponse) return ruleResponse;

    // 2. Fallback to AI Provider
    return await this.provider.generateReply(
      context,
      userInput,
      history,
      this.customPrompt,
    );
  }
}
