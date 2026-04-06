import { Request, Response } from "express";
import { MessageProcessor } from "../engine/processor";
import { ConversationManager } from "../conversation/conversation-manager";
import { InstagramClient } from "../integration/instagram-client";
import { generateReply } from "../utils/gemini";
import logger from "../logger/logger";

/**
 * Handles Instagram Webhooks (DMs and Comments)
 */
export class InstagramListener {
  /**
   * Handle incoming DM message
   */
  static async handleDM(req: Request, res: Response): Promise<void> {
    logger.info(`Received DM request. Headers: ${JSON.stringify(req.headers)}`);
    logger.info(`Received DM request. Body: ${JSON.stringify(req.body)}`);
    
    if (!req.body || Object.keys(req.body).length === 0) {
      logger.error("Received DM webhook with empty body. Ensure Postman headers (Content-Type: application/json) are set.");
      res.status(400).send("EMPTY_BODY");
      return;
    }
    // Check for Meta's official nested payload structure
    if (req.body.object === "instagram" && Array.isArray(req.body.entry)) {
      for (const entry of req.body.entry) {
        // 1. Check for Comment Events (changes)
        if (Array.isArray(entry.changes)) {
          return InstagramListener.handleComment(req, res);
        }

        // 2. Check for Messaging Events (DMs)
        if (!Array.isArray(entry.messaging)) continue;
        
        for (const msgEvent of entry.messaging) {
          const mSenderId = msgEvent.sender?.id;
          const mText = msgEvent.message?.text;
          
          if (mSenderId && mText) {
            try {
              MessageProcessor.process(mSenderId, mText, "instagram");
            } catch (error: any) {
              logger.error(`Failed to handle Instagram DM for ${mSenderId}`, { error: error.message });
            }
          }
        }
      }
      res.status(200).send("EVENT_RECEIVED");
      return;
    }

    // Fallback: Our flat Postman structure
    const { senderId, message, platform = "instagram" } = req.body;
    if (!senderId || !message) {
      logger.warn("Invalid flat payload received", { body: req.body });
      res.status(400).send("INVALID_PAYLOAD");
      return;
    }

    // Acknowledgement for webhook
    res.status(200).send("EVENT_RECEIVED");

    // Async processing for responsiveness & scalability
    try {
      MessageProcessor.process(senderId, message, platform);
    } catch (error: any) {
      logger.error(`Failed to handle Instagram DM for ${senderId}`, { error: error.message });
    }
  }

  // In-memory cache to deduplicate webhooks (commentId -> timestamp)
  private static processedComments = new Map<string, number>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Handle incoming post comments
   */
  static async handleComment(req: Request, res: Response): Promise<void> {
    logger.info(`Received Instagram comment webhook`, { body: JSON.stringify(req.body).slice(0, 500) });

    // 1. Acknowledge webhook immediately to Meta
    res.status(200).send("EVENT_RECEIVED");

    let extractedPayloads: any[] = [];

    // --- Step 2: Extract payloads from Meta's nested structure ---
    if (req.body.object === "instagram" && Array.isArray(req.body.entry)) {
      for (const entry of req.body.entry) {
        if (!Array.isArray(entry.changes)) continue;
        for (const change of entry.changes) {
          if (change.field !== "comments") continue;
          
          const value = change.value || {};
          const commentId = value.id;
          const senderId = value.from?.id;
          const text = value.text;

          if (commentId && senderId && text) {
            extractedPayloads.push({ commentId, senderId, text });
          }
        }
      }
    } else {
      // Fallback for flat/Postman test payloads
      const { senderId, comment, commentId } = req.body;
      if (senderId && (comment || commentId)) {
        extractedPayloads.push({ 
          commentId: commentId || `mock_${Date.now()}`, 
          senderId, 
          text: comment || "mock comment" 
        });
      }
    }

    if (extractedPayloads.length === 0) {
      logger.warn("No valid Instagram comment payloads found in webhook");
      return;
    }

    // --- Step 3: Process each comment in the funnel ---
    for (const payload of extractedPayloads) {
      const { commentId, senderId, text } = payload;
      const now = Date.now();
      const botId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "";

      try {
        // 1. Self-Reply Filter: Ignore if the sender is the bot itself
        if (botId && senderId === botId) {
          logger.info(`Ignoring self-reply from bot (${senderId})`);
          continue;
        }

        // 2. Deduplication
        if (InstagramListener.processedComments.has(commentId)) {
          const lastProcessed = InstagramListener.processedComments.get(commentId)!;
          if (now - lastProcessed < InstagramListener.CACHE_TTL) {
            logger.info(`Ignoring duplicate Instagram comment: ${commentId}`);
            continue;
          }
        }
        InstagramListener.processedComments.set(commentId, now);

        logger.info(`Processing Comment-to-Comment rapport for ${senderId}`, { commentId, text });

        // 1. Get or Create Lead for Comment history
        const lead = await ConversationManager.getLeadByHandle(senderId, "instagram");
        
        // 2. Add User Comment to History
        await ConversationManager.addMessage(lead.id, "user", text);

        // 3. Get Full History for Gemini Context
        const history = await ConversationManager.getHistory(lead.id);

        // 4. AI Relationship-Building Reply (Gemini)
        let publicReply: string | null = null;
        if (process.env.GEMINI_API_KEY) {
          publicReply = await generateReply("an Instagram post", text, history);
        }
        
        if (!publicReply) {
          publicReply = `Hey! Thanks for your comment. I'd love to chat more—feel free to DM me! 📩`;
        }

        // 5. Add AI Reply to History
        await ConversationManager.addMessage(lead.id, "ai", publicReply);

        // 6. Public Reply to Comment
        await InstagramClient.replyToComment(commentId, publicReply);

        logger.info(`Successfully replied to comment ${commentId} with history-aware AI`);

      } catch (error: any) {
        logger.error(`Error in Comment Relationship funnel for ${commentId}`, { error: error.message });
      }
    }

    // 4. Cleanup old cache entries occasionally
    if (InstagramListener.processedComments.size > 1000) {
      const expiration = Date.now() - InstagramListener.CACHE_TTL;
      for (const [id, time] of InstagramListener.processedComments.entries()) {
        if (time < expiration) InstagramListener.processedComments.delete(id);
      }
    }
  }
}
