import { ConversationManager } from "../conversation/conversation-manager";
import { HybridEngine } from "../engine/hybrid-engine";
import { Humanizer } from "../humanizer/humanizer-logic";
import { LeadExtractor } from "../leads/extractor";
import { SalesCommandClient } from "../integration/sales-command-client";
import { InstagramClient } from "../integration/instagram-client";
import { ThreadsClient } from "../integration/threads-client";
import { GeminiClient } from "../utils/gemini";
import logger from "../logger/logger";

/**
 * Core business logic for processing messages across platforms, isolated by organization
 */
export class MessageProcessor {
  private orgId: string;
  private instagramClient: InstagramClient;
  private threadsClient: ThreadsClient;
  private hybridEngine: HybridEngine;
  private leadExtractor: LeadExtractor;

  constructor(
    orgId: string, 
    instagramClient: InstagramClient, 
    threadsClient: ThreadsClient,
    geminiClient: GeminiClient,
    customPrompt?: string | null
  ) {
    this.orgId = orgId;
    this.instagramClient = instagramClient;
    this.threadsClient = threadsClient;
    this.hybridEngine = new HybridEngine(geminiClient, customPrompt);
    this.leadExtractor = new LeadExtractor(geminiClient);
  }

  /**
   * Processes an incoming message and triggers appropriate responses and qualifications
   */
  async process(
    senderId: string,
    message: string,
    platform: string,
    platformTargetId?: string,
    overrideReply?: string | null,
  ): Promise<void> {
    logger.info(`Processing message from ${senderId} on ${platform} (Org: ${this.orgId})`, {
      message,
      platformTargetId,
    });

    try {
      // 1. Get or Create Lead (Scoped to Org)
      const lead = await ConversationManager.getLeadByHandle(
        senderId,
        platform,
        this.orgId,
      );

      // 2. Persistent Tracking
      await ConversationManager.addMessage(lead.id, "user", message);

      // 3. Humanizer Delay (Typing stimulation)
      await Humanizer.typingDelay(message);

      // 4. Hybrid Engine Decision (Rules + LLM)
      const history = await ConversationManager.getHistory(lead.id);
      const replyText = overrideReply || (await this.hybridEngine.getResponse(history, message));

      // --- ASYNC BACKGROUND PROCESSING FOR LONG DELAYS ---
      setImmediate(async () => {
        try {
          // Wait a randomized duration (1 to 60 mins) before actually replying
          await Humanizer.longDelay();

          // 5. Respond and Log
          await ConversationManager.addMessage(lead.id, "ai", replyText);
          logger.info(`[${platform}] Reply generated for ${senderId} (Org: ${this.orgId})`, {
            reply: replyText,
          });

          if (platform === "instagram") {
            if (platformTargetId) {
              await this.instagramClient.replyToComment(platformTargetId, replyText);
            } else {
              await this.instagramClient.sendTextMessage(senderId, replyText);
            }
          } else if (platform === "threads") {
            if (platformTargetId) {
              const threadSent = await this.threadsClient.replyToComment(
                platformTargetId,
                replyText,
              );
              if (!threadSent) {
                logger.warn("Threads API reply failed; fallback may be required.", {
                  senderId,
                  commentId: platformTargetId,
                });
              }
            } else {
              logger.warn(
                "No target ID provided for Threads reply. Skipping direct API reply.",
                { senderId },
              );
            }
          }

          // 6. Lead Data Extraction (Metadata & Stages)
          const transcript = await ConversationManager.getHistory(lead.id);
          const extractedMetadata = await this.leadExtractor.extract(transcript);

          const updatedLead = await ConversationManager.updateMetadata(
            lead.id,
            extractedMetadata,
          );
          logger.debug(`Lead ${lead.id} metadata updated (Org: ${this.orgId})`, {
            status: updatedLead.lead_stage,
          });

          // 7. CRM Synchronization
          if (
            updatedLead.lead_stage === "qualified" ||
            updatedLead.lead_stage === "hot"
          ) {
            logger.info(`Syncing qualified lead to Sales Command (Org: ${this.orgId})`, { id: lead.id });
            await SalesCommandClient.syncLead(updatedLead);
          }
        } catch (bgError: any) {
          logger.error(`Error in background processing for ${senderId} (Org: ${this.orgId})`, {
            error: bgError.message,
          });
        }
      });
    } catch (error: any) {
      logger.error(`Error processing message from ${senderId} (Org: ${this.orgId})`, {
        error: error.message,
      });
    }
  }
}
