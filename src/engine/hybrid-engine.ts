import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Hybrid Intelligence System utilizing Rules + LLM
 */
export class HybridEngine {
  /**
   * Fast rule-based response for deterministic triggers
   * @param message User message text
   */
  static async checkRules(message: string): Promise<string | null> {
    const text = message.toLowerCase();
    
    // Simple examples of rule-based triggers
    if (text.includes("price") || text.includes("how much")) {
      return "I'd love to share our pricing packages with you! Are you looking for individual or team options?";
    }
    
    if (text.includes("demo") || text.includes("book a call")) {
      return "Absolutely! You can book a demo directly through our calendar link here: [CAL LINK]. What time works best?";
    }

    if (text.includes("hi") || text.includes("hello") || text.includes("hey")) {
      return "Hi there! 👋 I'm the AI Social Agent for Sales Command. How can I help you today?";
    }

    return null;
  }

  /**
   * LLM Fallback for complex queries
   * @param history Conversation history
   * @param userInput Message string
   */
  static async llmFallback(history: any[], userInput: string): Promise<string> {
    if (!OPENAI_API_KEY) {
      return "I'm sorry, I'm having trouble processing that right now. Could you try again later?";
    }

    const messages = [
      {
        role: "system" as const,
        content: `You are a professional AI Social Agent for Sales Command. 
        Your goal is to be helpful, human-like, and qualify leads. 
        You should capture Email and Phone naturally in the conversation.
        Keep responses concise (under 250 characters) for social media.`,
      },
      ...history.map((msg: any) => ({
        role: (msg.sender === "ai" ? "assistant" : "user") as "assistant" | "user",
        content: msg.text,
      })),
      { role: "user" as "user", content: userInput },
    ];

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview", // Or gpt-3.5-turbo for cost
        messages: messages,
        max_tokens: 150,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || "I'm here to help! Tell me more about your requirements.";
    } catch (error) {
      console.error("OpenAI Error:", error);
      return "I'm having a technical glitch, but I'll be back shortly! Can you send that again?";
    }
  }

  /**
   * Get the best response using hybrid approach
   */
  static async getResponse(history: any[], userInput: string): Promise<string> {
    const ruleResponse = await this.checkRules(userInput);
    if (ruleResponse) return ruleResponse;
    return await this.llmFallback(history, userInput);
  }
}
