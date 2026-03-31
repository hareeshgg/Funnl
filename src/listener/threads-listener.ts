import { Request, Response } from "express";
import { MessageProcessor } from "../engine/processor";
import { ThreadsClient } from "../integration/threads-client";
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

  private static extractThreadCommentPayload(body: any) {
    // Flatten legacy test payload
    if (body.senderId && body.comment && body.commentId) {
      return {
        senderId: body.senderId,
        comment: body.comment,
        commentId: body.commentId,
      };
    }

    // Threads Webhook structure (values array - used for 'moderate' topic)
    if (Array.isArray(body.values)) {
      for (const valObj of body.values) {
        const value = valObj.value || {};

        const commentText = value.text || "";
        const commentId = value.id || "";
        // Moderate topic provides username, but lacks a numeric user_id
        const senderId = value.username || "";

        if (senderId && commentText && commentId) {
          return {
            senderId,
            comment: commentText,
            commentId,
          };
        }
      }
    }

    // Facebook Webhook structure (entry/changes)
    if (body.object && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (!entry.changes || !Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
          const value = change.value || {};

          // Generic Threads comment schema that may be delivered in the future
          const commentText =
            value.text || value.message || value.comment || "";
          const commentId =
            value.comment_id ||
            value.id ||
            value.item_id ||
            value.post_id ||
            "";

          const senderId =
            value.from?.id || value.from?.username || value.user_id || "";

          if (senderId && commentText && commentId) {
            return {
              senderId,
              comment: commentText,
              commentId,
            };
          }
        }
      }
    }

    return null;
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
      body: req.body,
    });
    logger.info("Received Threads comment webhook", { body: req.body });

    let extracted = null;
    try {
      extracted = ThreadsListener.extractThreadCommentPayload(req.body);
    } catch (err: any) {
      logger.error("Payload extraction threw", {
        error: err.message,
        body: req.body,
      });
      // Always acknowledge webhook to avoid repeated retries
      res.status(200).send("EVENT_RECEIVED");
      return;
    }

    console.log("[THREADS] extracted payload:", extracted);

    if (
      !extracted ||
      !extracted.senderId ||
      !extracted.comment ||
      !extracted.commentId
    ) {
      logger.warn("Invalid Threads comment payload", { extracted });
      res.status(400).send("INVALID_PAYLOAD");
      return;
    }

    const { senderId, comment, commentId } = extracted;
    const platform = "threads";
    const botUsername = process.env.THREADS_BOT_USERNAME || "";

    // 1. Self-Reply Filter: Ignore if the sender is the bot itself
    if (botUsername && senderId.toLowerCase() === botUsername.toLowerCase()) {
      logger.info(`Ignoring self-reply from bot (${senderId})`);
      res.status(200).send("SELF_REPLY_IGNORED");
      return;
    }

    // 2. Deduplication: Ignore if we've already processed this comment ID recently
    const now = Date.now();
    if (ThreadsListener.processedComments.has(commentId)) {
      const lastProcessed = ThreadsListener.processedComments.get(commentId)!;
      if (now - lastProcessed < ThreadsListener.CACHE_TTL) {
        logger.info(`Ignoring duplicate Threads comment: ${commentId}`);
        res.status(200).send("DUPLICATE_IGNORED");
        return;
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

    // Acknowledgement for webhook
    res.status(200).send("EVENT_RECEIVED");

    try {
      logger.info(`Parsed Threads comment from ${senderId}`, {
        comment,
        commentId,
      });

      await MessageProcessor.process(senderId, comment, platform, commentId);

      logger.info(`Triggered Threads reply flow for comment ${commentId}`);
    } catch (error: any) {
      logger.error(`Error handling Threads comment for ${senderId}`, {
        error: error.message,
      });

      const fallbackReply =
        "Thanks for your comment! 🤖 The bot is temporarily unable to answer, but we'll follow up soon.";
      await ThreadsClient.replyToComment(commentId, fallbackReply);
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
