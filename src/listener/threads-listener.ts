import { Request, Response } from "express";
import { MessageProcessor } from "../engine/processor";
import { ThreadsClient } from "../integration/threads-client";
import { generateReply } from "../utils/gemini";
import logger from "../logger/logger";

/**
 * Handles Threads Automation (Posting + Mentions)
 */
export class ThreadsListener {
  /**
   * Handle incoming Threads mention / reply
   */
  static async handleMention(req: Request, res: Response): Promise<void> {
    const { senderId, content, platform = "threads" } = req.body;

    console.log(
      "[THREADS] incoming mention webhook:",
      JSON.stringify(req.body),
    );
    logger.info("Received Threads mention webhook", { body: req.body });

    // Acknowledgement for webhook
    res.status(200).send("EVENT_RECEIVED");

    try {
      await MessageProcessor.process(senderId, content, platform);
    } catch (error: any) {
      logger.error(`Error handling Threads mention for ${senderId}`, {
        error: error.message,
      });
    }
  }

  private static extractThreadCommentPayloads(body: any): any[] {
    logger.debug("Attempting to extract payloads from", { body });
    const payloads: any[] = [];

    // 1. Flatten legacy/Postman test payload
    if (
      body.senderId &&
      (body.comment || body.message || body.text) &&
      body.commentId
    ) {
      payloads.push({
        senderId: body.senderId,
        comment: body.comment || body.message || body.text || "",
        commentId: body.commentId,
        parentId: body.parentId || body.mediaId || body.post_id || "",
      });
      return payloads;
    }

    // 2. Threads Webhook structure (values array - used for 'moderate' topic)
    if (Array.isArray(body.values)) {
      for (const valObj of body.values) {
        const value = valObj.value || {};
        const commentText = value.text || value.message || "";
        const commentId = value.id || value.comment_id || "";
        const senderId =
          value.username ||
          value.from?.username ||
          value.from?.id ||
          value.user_id ||
          "";
        const parentId =
          value.parent_id || value.media_id || value.root_post?.id || "";

        if (senderId && (commentText || commentId)) {
          payloads.push({ senderId, comment: commentText, commentId, parentId });
        } else {
          logger.debug("Skipping invalid value snippet in moderate topic", {
            valObj,
          });
        }
      }
    }

    // 3. Facebook/Meta Webhook structure (entry/changes)
    if (body.object && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (!entry.changes || !Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
          const value = change.value || {};
          const commentText =
            value.text || value.message || value.comment || "";
          const commentId = value.id || value.comment_id || value.item_id || "";
          const senderId =
            value.from?.id ||
            value.from?.username ||
            value.user_id ||
            value.username ||
            "";
          const parentId =
            value.parent_id || value.media_id || value.post_id || "";

          if (senderId && commentText && commentId) {
            payloads.push({ senderId, comment: commentText, commentId, parentId });
          }
        }
      }
    }

    return payloads;
  }

  // In-memory cache to deduplicate webhooks (commentId -> timestamp)
  private static processedComments = new Map<string, number>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Handle Threads post comment events (public comment that we can reply to)
   */
  static async handleComment(req: Request, res: Response): Promise<void> {
    // Ultimate fallback: raw console log + winston to ensure delivery
    console.log("[THREADS] incoming comment webhook", {
      path: req.path,
      method: req.method,
      body: JSON.stringify(req.body).slice(0, 500),
    });
    logger.info("Received Threads comment webhook", { body: req.body });

    let payloads: any[] = [];
    try {
      payloads = ThreadsListener.extractThreadCommentPayloads(req.body);
    } catch (err: any) {
      logger.error("Payload extraction threw", {
        error: err.message,
        body: req.body,
      });
      res.status(200).send("EVENT_RECEIVED");
      return;
    }

    if (payloads.length === 0) {
      logger.warn("No valid Threads comment payloads found in webhook", {
        body: req.body,
      });
      res.status(200).send("NO_VALID_PAYLOADS_ACK");
      return;
    }

    // Acknowledge webhook immediately to Meta
    res.status(200).send("EVENT_RECEIVED");

    // Process each comment in the batch independently
    for (const extracted of payloads) {
      const { senderId, comment, commentId } = extracted;
      const platform = "threads";
      const botUsername = process.env.THREADS_BOT_USERNAME || "";

      try {
        // 1. Self-Reply Filter: Ignore if the sender is the bot itself
        if (botUsername && senderId.toLowerCase() === botUsername.toLowerCase()) {
          logger.info(`Ignoring self-reply from bot (${senderId})`);
          continue;
        } else {
          logger.debug(`Filter check: sender ${senderId} is NOT the bot ${botUsername}`);
        }

        // 2. Deduplication: Ignore if we've already processed this comment ID recently
        const now = Date.now();
        if (ThreadsListener.processedComments.has(commentId)) {
          const lastProcessed = ThreadsListener.processedComments.get(commentId)!;
          if (now - lastProcessed < ThreadsListener.CACHE_TTL) {
            logger.info(`Ignoring duplicate Threads comment: ${commentId}`);
            continue;
          }
        }

        // Mark as processed
        ThreadsListener.processedComments.set(commentId, now);

        // Cleanup old cache entries occasionally
        if (ThreadsListener.processedComments.size > 1000) {
          for (const [id, time] of ThreadsListener.processedComments.entries()) {
            if (now - time > ThreadsListener.CACHE_TTL) {
              ThreadsListener.processedComments.delete(id);
            }
          }
        }

        logger.info(`Processing Threads comment from ${senderId}`, {
          comment,
          commentId,
          parentId: extracted.parentId,
        });

        // 3. AI Reply Generation (Gemini)
        let aiReply: string | null = null;
        if (process.env.GEMINI_API_KEY) {
          const threadText = extracted.parentId
            ? await ThreadsClient.getThreadContent(extracted.parentId)
            : "a Threads post";

          aiReply = await generateReply(threadText, comment);
        }

        // 4. Unified Processor Flow (Tracking, CRM, and Reply)
        await MessageProcessor.process(
          senderId,
          comment,
          platform,
          commentId,
          aiReply,
        );

        logger.info(`Successfully processed Threads comment ${commentId}`);
      } catch (error: any) {
        logger.error(`Error processing batch comment ${commentId} for ${senderId}`, {
          error: error.message,
        });

        const fallbackReply =
          "Thanks for your comment! 🤖 The bot encountered a minor issue, but we'll follow up soon.";
        await ThreadsClient.replyToComment(commentId, fallbackReply);
      }
    }
  }

  /**
   * Automated Posting (New Thread)
   */
  static async createPost(req: Request, res: Response): Promise<void> {
    const { content } = req.body;
    logger.info(`[Threads] Creating automated post: ${content}`);
    res
      .status(201)
      .json({ status: "success", thread_id: "thread_" + Date.now() });
  }
}
