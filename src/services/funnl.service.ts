import { prisma } from "../db/prisma";
import { decrypt } from "../utils/encryption";
import { InstagramClient } from "../integration/instagram-client";
import { ThreadsClient } from "../integration/threads-client";
import { MessageProcessor } from "../engine/processor";
import { ProviderFactory } from "../engine/providers/ProviderFactory";
import logger from "../logger/logger";

export class FunnlService {
  private static processedEvents = new Map<string, number>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Main entry point for processing any incoming Meta webhook event in a multi-tenant way.
   */
  static async processWebhookEvent(platformUserId: string, entry: any, platformType: "instagram" | "threads" = "instagram"): Promise<void> {
    // 1. Lookup Org Config by ID for the corresponding platform
    const config = await prisma.aiFunnlConfig.findFirst({
      where: {
        OR: [
          { instagram_account_id: platformUserId },
          { threads_account_id: platformUserId }
        ]
      },
    });

    if (!config) {
      logger.warn(`No config found for Platform User ID: ${platformUserId} (${platformType}). Ignoring event.`);
      return;
    }

    // 2. Initialize Org-specific Clients & AI
    const instagramAccessToken = decrypt(config.instagram_access_token);
    const threadsAccessToken = decrypt(config.threads_access_token);
    
    // Decrypt all potential API keys
    const decryptedConfig = {
      ...config,
      gemini_api_key: decrypt(config.gemini_api_key) || process.env.GEMINI_API_KEY || "",
      openai_api_key: decrypt(config.openai_api_key) || process.env.OPENAI_API_KEY || "",
      deepseek_api_key: decrypt(config.deepseek_api_key) || process.env.DEEPSEEK_API_KEY || "",
      grok_api_key: decrypt(config.grok_api_key) || process.env.GROK_API_KEY || "",
      qwen_api_key: decrypt(config.qwen_api_key) || process.env.QWEN_API_KEY || "",
    };
    
    // Fallback: use the main token if platform specific one isn't available
    const activeInstagramToken = instagramAccessToken;
    const activeThreadsToken = threadsAccessToken || instagramAccessToken;

    if (!activeInstagramToken && !activeThreadsToken) {
      logger.error(`No access tokens available for Org: ${config.org_id}`);
      return;
    }

    const instagramClient = new InstagramClient(activeInstagramToken || "");
    const threadsClient = new ThreadsClient(activeThreadsToken || "");
    const provider = ProviderFactory.getProvider(decryptedConfig);

    const processor = new MessageProcessor(
      config.org_id, 
      instagramClient, 
      threadsClient, 
      provider, 
      config.custom_prompt
    );

    // 3. Handle Messaging Events (DMs - only IG supported for now)
    if (Array.isArray(entry.messaging)) {
      if (!config.auto_reply_dm) {
        logger.info(`Auto-reply DM disabled for org ${config.org_id}. skipping.`);
      } else {
        for (const msgEvent of entry.messaging) {
          const senderId = msgEvent.sender?.id;
          const text = msgEvent.message?.text;
          const mid = msgEvent.message?.mid;

          if (senderId && text && mid) {
            if (
              senderId === platformUserId ||
              senderId === config.instagram_account_id ||
              senderId === config.threads_account_id ||
              senderId === config.threads_bot_username
            ) {
              logger.debug(`[Funnl] Skipping self-reply (DM) from sender: ${senderId}`);
              continue; // Self-reply Filter
            }
            if (this.isDuplicate(mid)) continue; // Deduplication

            await processor.process(senderId, text, "instagram");
          }
        }
      }
    }

    // 4. Handle Changes (Comments / Replies)
    if (Array.isArray(entry.changes)) {
      if (!config.auto_reply_comments) {
        logger.info(`Auto-reply comments disabled for org ${config.org_id}. skipping.`);
      } else {
        for (const change of entry.changes) {
          // Instagram uses "comments", Threads uses "reply"
          if (change.field === "comments" || change.field === "reply") {
            const val = change.value;
            const senderId = val.from?.id;
            const text = val.text;
            const commentId = val.id;

            if (senderId && text && commentId) {
              if (
                senderId === platformUserId ||
                senderId === config.instagram_account_id ||
                senderId === config.threads_account_id ||
                senderId === config.threads_bot_username
              ) {
                logger.debug(`[Funnl] Skipping self-reply (Comment/Reply) from sender: ${senderId}`);
                continue; // Self-reply Filter
              }
              if (this.isDuplicate(commentId)) continue; // Deduplication

              // Determine platform based on payload hint or config presence
              const activePlatform = (platformType === "threads" || entry.id === config.threads_account_id) ? "threads" : "instagram";

              await processor.process(senderId, text, activePlatform, commentId);
            }
          }
        }
      }
    }

    this.cleanupCache();
  }

  private static isDuplicate(eventId: string): boolean {
    const now = Date.now();
    if (this.processedEvents.has(eventId)) {
      const lastTime = this.processedEvents.get(eventId)!;
      if (now - lastTime < this.CACHE_TTL) return true;
    }
    this.processedEvents.set(eventId, now);
    return false;
  }

  private static cleanupCache() {
    if (this.processedEvents.size > 2000) {
      const expiration = Date.now() - this.CACHE_TTL;
      for (const [id, time] of this.processedEvents.entries()) {
        if (time < expiration) this.processedEvents.delete(id);
      }
    }
  }
}
