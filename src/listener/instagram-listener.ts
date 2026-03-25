import { Request, Response } from "express";
import { MessageProcessor } from "../engine/processor";
import logger from "../logger/logger";

/**
 * Handles Instagram Webhooks (DMs and Comments)
 */
export class InstagramListener {
  /**
   * Handle incoming DM message
   */
  static async handleDM(req: Request, res: Response): Promise<void> {
    const { senderId, message, platform = "instagram" } = req.body;

    // Acknowledgement for webhook
    res.status(200).send("EVENT_RECEIVED");

    // Async processing for responsiveness & scalability
    try {
      MessageProcessor.process(senderId, message, platform);
    } catch (error: any) {
      logger.error(`Failed to handle Instagram DM for ${senderId}`, { error: error.message });
    }
  }

  /**
   * Handle incoming post comments
   */
  static async handleComment(req: Request, res: Response): Promise<void> {
    const { senderId, comment, platform = "instagram" } = req.body;

    // Acknowledgement for webhook
    res.status(200).send("EVENT_RECEIVED");

    try {
       logger.info(`Received comment from ${senderId}: ${comment}`);
      
       // Logic for Comment-to-DM Funnel
       // 1. Log and trigger human-like reply 
       const initialReply = `Hey! Thanks for your comment. I've sent you a DM to discuss further.`;
       logger.info(`[Public Reply] ${initialReply}`);

       const firstDM = `Hi! I saw your comment on our post about "${comment.slice(0, 20)}...". How can I help?`;
       
       // 2. Start persistent conversation with lead
       // Note: We use MessageProcessor.process to initiate the flow
       MessageProcessor.process(senderId, firstDM, platform);

    } catch (error: any) {
       logger.error(`Error handling Instagram Comment for ${senderId}`, { error: error.message });
    }
  }
}
