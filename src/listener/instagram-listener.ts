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
