import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import logger from "../logger/logger";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const model = genAI
  ? genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
    })
  : null;

/**
 * Generates a context-aware AI reply for a comment (Instagram or Threads).
 *
 * @param postContext Summary of the original post or "an Instagram post/Threads post"
 * @param currentComment Content of the latest incoming comment
 * @param history Array of past interactions for relationship building
 * @returns Generated reply string
 */
export async function generateReply(
  postContext: string,
  currentComment: string,
  history: any[] = [],
): Promise<string | null> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      logger.error("GEMINI_API_KEY is not defined in environment variables.");
      return null;
    }

    const conversationContext = history
      .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join("\n");

    const prompt = `
You are a human social media user building relationships in the comments section of your post.

Post Context: "${postContext}"
Previous Conversation:
${conversationContext || "No previous history."}

New Incoming Comment: "${currentComment}"

Rules for Engagement:
1. BE HUMAN: Reply naturally, casually, and authentically. No generic bot phrases.
2. BUILD RAPPORT: Focus on the user, answer their questions publicly, and be helpful.
3. THE "NUDGE" TO DM:
   - If this is the FIRST or SECOND interaction, DO NOT ask them to DM. Just be helpful.
   - If the conversation is warm (3+ messages) OR the user asks for pricing, private info, or a link, ask them to "DM me for the details so we can chat further!"
4. BREVITY: Keep it short (1-2 sentences max).
5. FORMAT: Return ONLY the reply text. Do not include labels like "Reply:".

Example 1 (Early Interaction):
Comment: "Love this! How long did it take?"
Reply: "Thanks! It took about 3 weeks of late nights, but totally worth it haha."

Example 2 (Warm Interaction):
History: [User asks about features, AI answers]
Comment: "Sounds perfect. How can I get started?"
Reply: "I'd love to help with that! DM me so I can get you the setup link and some extra info! 📩"

Current Reply:`;

    const result = await (model as any).generateContent(prompt);
    let text = result.response.text().trim();

    // Clean up any accidental labelling
    if (text.includes("Reply:")) {
      text = text.split("Reply:").pop()?.trim() || text;
    }
    text = text.replace(/^"|"$/g, "");

    return text;
  } catch (error: any) {
    logger.error("Gemini Error:", { error: error.message });
    return "Thanks for your comment! I'd love to chat more—feel free to DM me! 📩"; // fallback
  }
}
