import { ConversationManager } from "../conversation/conversation-manager";
import { HybridEngine } from "../engine/hybrid-engine";
import { Humanizer } from "../humanizer/humanizer-logic";
import { LeadExtractor } from "../leads/extractor";
import { SalesCommandClient } from "../integration/sales-command-client";
import logger from "../logger/logger";

/**
 * Core business logic for processing messages across platforms
 */
export class MessageProcessor {
  /**
   * Processes an incoming message and triggers appropriate responses and qualifications
   */
  static async process(senderId: string, message: string, platform: string): Promise<void> {
    logger.info(`Processing message from ${senderId} on ${platform}`, { message });

    try {
      // 1. Get or Create Lead
      const lead = await ConversationManager.getLeadByHandle(senderId, platform);

      // 2. Persistent Tracking
      await ConversationManager.addMessage(lead.id, "user", message);

      // 3. Humanizer Delay (Typing stimulation)
      await Humanizer.typingDelay(message);

      // 4. Hybrid Engine Decision (Rules + LLM)
      const history = await ConversationManager.getHistory(lead.id);
      const replyText = await HybridEngine.getResponse(history, message);

      // 5. Respond and Log
      await ConversationManager.addMessage(lead.id, "ai", replyText);
      logger.info(`[${platform}] Reply sent to ${senderId}`, { reply: replyText });

      // 6. Lead Data Extraction (Metadata & Stages)
      const transcript = await ConversationManager.getHistory(lead.id);
      const extractedMetadata = await LeadExtractor.extract(transcript);
      
      const updatedLead = await ConversationManager.updateMetadata(lead.id, extractedMetadata);
      logger.debug(`Lead ${lead.id} metadata updated`, { status: updatedLead.lead_stage });

      // 7. CRM Synchronization
      if (updatedLead.lead_stage === "qualified" || updatedLead.lead_stage === "hot") {
        logger.info(`Syncing qualified lead to Sales Command`, { id: lead.id });
        await SalesCommandClient.syncLead(updatedLead);
      }

    } catch (error: any) {
      logger.error(`Error processing message from ${senderId}`, { error: error.message });
      // Basic retry mechanism would go here
    }
  }
}
