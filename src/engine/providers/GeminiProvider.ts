import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { BaseProvider } from "./BaseProvider";
import logger from "../../logger/logger";

/**
 * GeminiProvider — Google Gemini / Generative Language API.
 */
export class GeminiProvider extends BaseProvider {
  private genAI: GoogleGenerativeAI;
  private modelInstance: GenerativeModel;

  constructor(apiKey: string, model: string, settings: any = {}) {
    super(apiKey, model, settings);
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelInstance = this.genAI.getGenerativeModel({ model });
  }

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
Goal: Build rapport, be helpful, and naturally qualify leads.
Context: "${context}"
History:
${conversationContext || "No previous history."}
New Input: "${userPrompt}"

Rules:
1. BE HUMAN: Natural, concise, and authentic.
2. BREVITY: 1-2 sentences max.
3. CONTEXTUAL: Answer correctly based on the post/message.
`;

    try {
      // Use system_instruction if available (models >= 1.5)
      const result = await this.modelInstance.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] as any },
        generationConfig: {
          temperature: this.settings.temperature ?? 0.7,
          maxOutputTokens: this.settings.maxOutputTokens ?? 2048,
        }
      } as any);

      const text = result.response.text().trim();
      return this._normalizeResponse(text);
    } catch (error: any) {
      logger.error("Gemini Provider Generation Error:", { error: error.message });
      // Fallback to legacy format if systemInstruction fails or model is older
      try {
        const result = await this.modelInstance.generateContent(systemPrompt);
        return this._normalizeResponse(result.response.text());
      } catch (fallbackError) {
        return "Thanks for reaching out! I'd love to chat more—feel free to DM me! 📩";
      }
    }
  }

  /**
   * Extracts structured lead data from a conversation transcript.
   */
  async extractLeadData(history: any[]): Promise<any> {
    const transcript = history.map((m) => `${m.sender}: ${m.text}`).join("\n");

    const prompt = `
Analyze the following transcript and extract lead info in JSON format:
- email: string | null
- phone: string | null
- intent: "buying" | "browsing" | "curious" | null
- product_interest: string | null
- budget: string | null
- sentiment: "positive" | "neutral" | "negative" | null
- lead_stage: "new" | "qualified" | "hot"

Transcript:
${transcript}

Return ONLY valid JSON.
`;

    try {
      const result = await this.modelInstance.generateContent(prompt);
      let text = result.response.text().trim();
      text = text.replace(/```json|```/g, "").trim();
      return JSON.parse(text);
    } catch (error: any) {
      logger.error("Gemini Extraction Error:", { error: error.message });
      return {};
    }
  }
}
