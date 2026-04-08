import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import logger from "../logger/logger";

/**
 * Service to interact with Google Gemini AI API
 */
export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash-lite", // Efficient and cheap
    });
  }

  /**
   * Generates a context-aware AI reply for a comment or message.
   */
  async generateReply(
    context: string,
    userInput: string,
    history: any[] = [],
    customPrompt?: string | null
  ): Promise<string> {
    const conversationContext = history
      .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join("\n");

    const systemPrompt = customPrompt || `
You are a professional yet friendly AI Social Agent. 
Goal: Build rapport, be helpful, and naturally qualify leads.
Context: "${context}"
History:
${conversationContext || "No previous history."}
New Input: "${userInput}"

Rules:
1. BE HUMAN: Natural, concise, and authentic.
2. BREVITY: 1-2 sentences max.
3. CONTEXTUAL: Answer correctly based on the post/message.
`;

    try {
      const result = await this.model.generateContent(systemPrompt);
      let text = result.response.text().trim();
      
      // Clean up common AI artifacts
      text = text.replace(/^"|"$/g, "");
      if (text.includes("Reply:")) text = text.split("Reply:").pop()?.trim() || text;

      return text;
    } catch (error: any) {
      logger.error("Gemini Generation Error:", { error: error.message });
      return "Thanks for reaching out! I'd love to chat more—feel free to DM me! 📩";
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
      const result = await this.model.generateContent(prompt);
      let text = result.response.text().trim();
      
      // Remove possible markdown code blocks
      text = text.replace(/```json|```/g, "").trim();
      
      return JSON.parse(text);
    } catch (error: any) {
      logger.error("Gemini Extraction Error:", { error: error.message });
      return {};
    }
  }
}
