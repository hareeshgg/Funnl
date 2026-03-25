import { Request, Response } from "express";
import { MessageProcessor } from "../engine/processor";
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

    // Acknowledgement for webhook
    res.status(200).send("EVENT_RECEIVED");

    try {
      // Async processing to handle scaling and high traffic
      MessageProcessor.process(senderId, content, platform);
    } catch (error: any) {
      logger.error(`Error handling Threads Mention for ${senderId}`, { error: error.message });
    }
  }

  /**
   * Automated Posting (New Thread)
   */
  static async createPost(req: Request, res: Response): Promise<void> {
     const { content } = req.body;
     logger.info(`[Threads] Creating automated post: ${content}`);
     res.status(201).json({ status: "success", thread_id: "thread_" + Date.now() });
  }
}
