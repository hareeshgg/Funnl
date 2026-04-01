import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import logger from "../logger/logger";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const model = genAI
  ? genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    })
  : null;

/**
 * Generates a context-aware AI reply for a Threads comment.
 *
 * @param threadText Content of the original thread/post
 * @param commentText Content of the incoming comment
 * @returns Generated reply string
 */
export async function generateReply(
  threadText: string,
  commentText: string,
): Promise<string | null> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      logger.error("GEMINI_API_KEY is not defined in environment variables.");
      return null;
    }

    const prompt = `
You are a human social media user replying to comments on your Threads post.

Post: "${threadText}"
Comment: "${commentText}"

Rules:
- Reply naturally like a real person.
- Keep it short (1 sentence preferred).
- Be context-aware.
- Avoid robotic or generic phrases.
- Match tone of the comment (casual, excited, supportive).

Examples:
Post: "I just made my first chatbot"
Comment: "Congratulations"
Reply: "Thanks man, I gave my all!"

Post: "Finally launched my startup"
Comment: "Woah 🔥"
Reply: "Thank you!! Means a lot 🔥"

Now generate a reply:
`;

    const result = await (model as any).generateContent(prompt);
    const text = result.response.text();

    return text.trim();
  } catch (error: any) {
    logger.error("Gemini Error:", { error: error.message });
    return "Thanks a lot! 🙌"; // fallback response
  }
}
