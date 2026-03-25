import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Lead Metadata and Structured Data Extractor
 */
export class LeadExtractor {
  /**
   * Extracts contact information and intent from conversation history
   * @param history Conversation messages
   */
  static async extract(history: any[]): Promise<any> {
    if (!OPENAI_API_KEY) return {};

    const transcript = history.map((msg: any) => `${msg.sender}: ${msg.text}`).join("\n");

    const prompt = `Analyze the following transcript from an AI Social Agent interaction. 
    Extract the following information in JSON format:
    - email: string | null
    - phone: string | null
    - intent: "buying" | "browsing" | "curious" | null
    - product_interest: string | null
    - budget: string | null
    - sentiment: "positive" | "neutral" | "negative" | null
    - lead_stage: "new" | "qualified" | "hot" (qualified if email or phone is present, hot if buying intent and contact info present)

    Transcript:
    ${transcript}

    Respond ONLY with valid JSON.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-0125", // Cost-effective for extraction
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      return result;
    } catch (error) {
      console.error("Extraction error:", error);
      return {};
    }
  }
}
