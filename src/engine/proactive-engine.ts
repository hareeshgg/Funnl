import { BaseProvider } from "./providers/BaseProvider";
import logger from "../logger/logger";

export interface CategoryQuery {
  keywords: string[];
  hashtags: string[];
  intent: string;
}

export class ProactiveEngine {
  private provider: BaseProvider;

  constructor(provider: BaseProvider) {
    this.provider = provider;
  }

  /**
   * Generates a structural JSON query matching the desired category.
   * Employs the AI Provider to brainstorm hashtags and keywords.
   */
  async generateQueriesForCategory(categoryName: string): Promise<CategoryQuery | null> {
    const prompt = `
      You are an expert social media growth assistant.
      The user wants to proactively engage with posts under the category: "${categoryName}".
      
      Generate a JSON response containing:
      1. "keywords": an array of 2-5 relevant keywords that might appear in post captions.
      2. "hashtags": an array of 2-5 relevant hashtags (include the #).
      3. "intent": A brief phrase describing the underlying intent or mood of these posts.

      Return ONLY valid JSON, without any markdown formatting wrappers or extra text.
      Example: {"keywords": ["gym", "workout"], "hashtags": ["#fitness", "#gymlife"], "intent": "motivation"}
    `;

    try {
      const response = await this.provider.generateReply(
        "social media categorization",
        prompt,
        [],
        null
      );

      // Clean the response in case it contains markdown blocks
      let cleanJson = response.trim();
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace('```json', '');
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace('```', '');
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.replace(/```$/, '');

      return JSON.parse(cleanJson.trim()) as CategoryQuery;
    } catch (e: any) {
      logger.error("Failed to generate queries for category", { error: e.message, category: categoryName });
      return null;
    }
  }

  /**
   * Generates a concise, non-promotional comment based on the context.
   */
  async generateProactiveComment(caption: string, intent: string): Promise<string> {
    const prompt = `
      You are interacting proactively with a potential lead on Instagram.
      Post Caption: "${caption}"
      Target Category Intent: "${intent}"
      
      Task: Write a high-quality, human-like comment for this post.
      
      Guidelines:
      - Keep it concise (under 20 words).
      - Ask a subtle, engaging question related to the caption.
      - NEVER sound promotional. Do not mention selling or offering anything.
      - Avoid generic praise like "Nice pic" or "Great post".

      Provide only the text of the comment without quotes.
    `;

    try {
      const response = await this.provider.generateReply(
        "Generate a non-promotional, engaging comment",
        prompt,
        [],
        null
      );
      
      let comment = response.trim();
      // Remove surrounding quotes if they were added
      if (comment.startsWith('"') && comment.endsWith('"')) {
        comment = comment.substring(1, comment.length - 1);
      }
      return comment;
    } catch (e: any) {
      logger.error("Failed to generate proactive comment.", { error: e.message });
      return "Love this perspective! How long have you been focusing on this?";
    }
  }

  /**
   * Calculate a normalized score for an instagram post.
   */
  filterAndRankPosts(posts: any[], keywords: string[]): any[] {
    const getRelevance = (caption: string) => {
      if (!caption) return 0;
      let matches = 0;
      const lowerCaption = caption.toLowerCase();
      keywords.forEach(kw => {
        if (lowerCaption.includes(kw.toLowerCase())) matches++;
      });
      return matches;
    };

    return posts.map(post => {
      const engagementScore = (post.like_count || 0) + (post.comments_count || 0) * 2;
      const relevanceScore = getRelevance(post.caption) * 10;
      const score = (engagementScore * 0.4) + (relevanceScore * 0.6);
      
      return {
        ...post,
        calculatedScore: score,
        engagementScore,
        relevanceScore
      };
    }).sort((a, b) => b.calculatedScore - a.calculatedScore);
  }
}
