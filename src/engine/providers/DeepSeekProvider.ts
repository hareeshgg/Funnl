import axios from "axios";
import { BaseProvider } from "./BaseProvider";
import logger from "../../logger/logger";

const DEEPSEEK_API_BASE = "https://api.deepseek.com";

/**
 * DeepSeekProvider — DeepSeek Chat API.
 */
export class DeepSeekProvider extends BaseProvider {
  async generateReply(
    context: string,
    userPrompt: string,
    history: any[],
    customSystemPrompt?: string | null
  ): Promise<string> {
    this.validateConfig();

    const conversationContext = history
      .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join("\n");

    const systemPrompt = customSystemPrompt || `
You are a professional yet friendly AI Social Agent. 
Context: "${context}"
History:
${conversationContext || "No previous history."}
`;

    // Construct messages
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map(m => ({
        role: m.sender === "ai" ? "assistant" : "user",
        content: m.text
      })),
      { role: "user", content: userPrompt }
    ];

    try {
      const response = await axios.post(
        `${DEEPSEEK_API_BASE}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: this.settings.temperature ?? 0.7,
          max_tokens: this.settings.maxTokens ?? 2048,
        },
        { 
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`
          }, 
          timeout: 60000 
        }
      );

      let text = response.data?.choices?.[0]?.message?.content || "";

      // DeepSeek Specific Cleaning: Remove instruction confirmations
      text = text.replace(/^(Got it|Understood|Okay|Alright)[.,!]\s*/i, "");
      text = text.replace(/^Ready to be .*[.,!]\s*/im, "");
      text = text.replace(/^I'll make sure to .*[.,!]\s*/im, "");

      return this._normalizeResponse(text);
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[DeepSeekProvider] API error (${status}): ${message}`);
      throw new Error(`DeepSeek API error: ${message}`);
    }
  }

  async extractLeadData(history: any[]): Promise<any> {
    logger.warn("Lead extraction not yet specialized for DeepSeek. Using transcript.");
    return {}; // Placeholder for now
  }
}
