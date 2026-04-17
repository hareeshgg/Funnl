import { prisma } from "../db/prisma";
import logger from "../logger/logger";
import { ProviderFactory } from "../engine/providers/ProviderFactory";
import { InstagramClient } from "../integration/instagram-client";
import { ProactiveEngine, CategoryQuery } from "../engine/proactive-engine";
import { decrypt } from "../utils/encryption";

export class ProactiveService {
  /**
   * Retrieves a decrypted config safely.
   */
  private static async getConfig(orgId: string) {
    const config = await prisma.aiFunnlConfig.findUnique({
      where: { org_id: orgId }
    });

    if (!config) return null;

    return {
      ...config,
      instagram_access_token: decrypt(config.instagram_access_token),
      gemini_api_key: decrypt(config.gemini_api_key) || process.env.GEMINI_API_KEY || "",
      openai_api_key: decrypt(config.openai_api_key) || process.env.OPENAI_API_KEY || "",
      deepseek_api_key: decrypt(config.deepseek_api_key) || process.env.DEEPSEEK_API_KEY || "",
      grok_api_key: decrypt(config.grok_api_key) || process.env.GROK_API_KEY || "",
      qwen_api_key: decrypt(config.qwen_api_key) || process.env.QWEN_API_KEY || ""
    };
  }

  /**
   * Creates a category and generates its associated keywords and hashtags.
   */
  static async createCategory(orgId: string, categoryName: string) {
    const config = await this.getConfig(orgId);
    if (!config) throw new Error("Funnl config not found for organization.");

    const provider = ProviderFactory.getProvider(config);
    const engine = new ProactiveEngine(provider);

    logger.info(`Generating proactive queries for category: ${categoryName}`);
    const queries = await engine.generateQueriesForCategory(categoryName);
    
    if (!queries) {
      throw new Error("Failed to generate queries from AI.");
    }

    const category = await prisma.proactive_categories.create({
      data: {
        org_id: orgId,
        name: categoryName,
        keywords: queries.keywords,
        hashtags: queries.hashtags,
        intent: queries.intent
      }
    });

    return category;
  }

  /**
   * Discover and engage workflow. 
   * Fetches media -> Ranks -> Filters Top 10 -> Generates Comments -> Saves.
   */
  static async runDiscoveryIteration(orgId: string, categoryId: string) {
    const config = await this.getConfig(orgId);
    if (!config || !config.instagram_access_token || !config.instagram_account_id) {
      throw new Error("Instagram integration not fully configured.");
    }

    const category = await prisma.proactive_categories.findUnique({
      where: { id: categoryId }
    });

    if (!category) throw new Error("Category not found");

    const igClient = new InstagramClient(config.instagram_access_token);
    const provider = ProviderFactory.getProvider(config);
    const engine = new ProactiveEngine(provider);

    const hashtags = category.hashtags as string[] || [];
    let allMedia: any[] = [];

    // Fetch media for up to 3 hashtags (Meta API limits)
    for (const tag of hashtags.slice(0, 3)) {
      const hashtagId = await igClient.getHashtagId(tag, config.instagram_account_id);
      if (hashtagId) {
        const media = await igClient.getMediaByHashtag(hashtagId, config.instagram_account_id, 'top_media', 20);
        allMedia = allMedia.concat(media);
      }
    }

    // Filter duplicates
    const uniqueMediaMap = new Map();
    allMedia.forEach(m => {
      if (!uniqueMediaMap.has(m.id)) {
        uniqueMediaMap.set(m.id, m);
      }
    });
    const uniqueMedia = Array.from(uniqueMediaMap.values());

    // Rank posts
    const rankedPosts = engine.filterAndRankPosts(uniqueMedia, category.keywords as string[] || []);

    // Take top 10
    const top10 = rankedPosts.slice(0, 10);
    const processedResults = [];

    // Process top 10
    for (const post of top10) {
      // Check if already processed
      const exists = await prisma.proactive_posts.findUnique({
        where: { platform_post_id: post.id.toString() }
      });

      if (!exists) {
        const savedPost = await prisma.proactive_posts.create({
          data: {
            category_id: category.id,
            platform_post_id: post.id.toString(),
            caption: post.caption || '',
            url: post.permalink || '',
            engagement_score: post.engagementScore || 0,
            relevance_score: post.relevanceScore || 0,
            status: 'new'
          }
        });

        const intent = category.intent || "social media interaction";
        const generatedComment = await engine.generateProactiveComment(post.caption || '', intent);

        const log = await prisma.proactive_engagement_logs.create({
          data: {
            post_id: savedPost.id,
            action_type: 'COMMENT',
            ai_generated_content: generatedComment,
            status: 'pending' // Note: 'pending' indicates we haven't posted it yet
          }
        });

        processedResults.push({ post: savedPost, action: log });
      }
    }

    return processedResults;
  }
}
