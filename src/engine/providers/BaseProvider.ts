/**
 * BaseProvider — Abstract base class for all AI providers in AI Social Agent.
 */
export abstract class BaseProvider {
  protected apiKey: string;
  protected model: string;
  protected settings: any;

  constructor(apiKey: string, model: string, settings: any = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.settings = settings;
  }

  /**
   * Main entry point for generating a reply.
   */
  abstract generateReply(
    context: string,
    userPrompt: string,
    history: any[],
    systemPrompt?: string | null
  ): Promise<string>;

  /**
   * Extracts structured lead data from a conversation transcript.
   */
  abstract extractLeadData(history: any[]): Promise<any>;

  /**
   * Normalizes the response text, stripping artifacts and trimming.
   */
  protected _normalizeResponse(text: string): string {
    let cleaned = (text || "").trim();

    // Clean up common AI artifacts
    cleaned = cleaned.replace(/^"|"$/g, ""); // Strip surrounding quotes

    // Strip common prefixes
    const prefixes = [/^Reply:\s*/i, /^Assistant:\s*/i, /^System:\s*/i, /^AI:\s*/i];
    for (const prefix of prefixes) {
      cleaned = cleaned.replace(prefix, "");
    }

    return cleaned.trim();
  }

  /**
   * Validation helper
   */
  protected validateConfig(): void {
    if (!this.apiKey) {
      throw new Error(`${this.constructor.name} requires an API key.`);
    }
    if (!this.model) {
      throw new Error(`${this.constructor.name} requires a model selection.`);
    }
  }
}
