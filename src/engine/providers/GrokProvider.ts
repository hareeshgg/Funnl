import axios from "axios";
import { BaseProvider } from "./BaseProvider";
import logger from "../../logger/logger";

const GROK_API_BASE = "https://api.x.ai/v1";

/**
 * GrokProvider — xAI Grok API.
 */
export class GrokProvider extends BaseProvider {
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
        `${GROK_API_BASE}/chat/completions`,
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
          timeout: 45000 
        }
      );

      const text = response.data?.choices?.[0]?.message?.content || "";
      return this._normalizeResponse(text);
    } catch (error: any) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;
      logger.error(`[GrokProvider] API error (${status}): ${message}`);
      throw new Error(`Grok API error: ${message}`);
    }
  }

  async extractLeadData(history: any[]): Promise<any> {
    return {}; // Placeholder
  }
}
