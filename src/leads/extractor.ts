import { GeminiClient } from "../utils/gemini";
import logger from "../logger/logger";

/**
 * Lead Metadata and Structured Data Extractor per Organization
 */
export class LeadExtractor {
  private geminiClient: GeminiClient;

  constructor(geminiClient: GeminiClient) {
    this.geminiClient = geminiClient;
  }

  /**
   * Extracts contact information and intent from conversation history using Gemini
   * @param history Conversation messages
   */
  async extract(history: any[]): Promise<any> {
    if (history.length === 0) return {};

    try {
      return await this.geminiClient.extractLeadData(history);
    } catch (error: any) {
      logger.error("Extraction error:", { error: error.message });
      return {};
    }
  }
}
