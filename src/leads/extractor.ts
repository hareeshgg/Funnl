import { BaseProvider } from "../engine/providers/BaseProvider";
import logger from "../logger/logger";

/**
 * Lead Metadata and Structured Data Extractor per Organization
 */
export class LeadExtractor {
  private provider: BaseProvider;

  constructor(provider: BaseProvider) {
    this.provider = provider;
  }

  /**
   * Extracts contact information and intent from conversation history using Gemini
   * @param history Conversation messages
   */
  async extract(history: any[]): Promise<any> {
    if (history.length === 0) return {};

    try {
      return await this.provider.extractLeadData(history);
    } catch (error: any) {
      logger.error("Extraction error:", { error: error.message });
      return {};
    }
  }
}
