import { Lead } from "@prisma/client";
import { prisma } from "../db/prisma";
import logger from "../logger/logger";

/**
 * Handles persistent tracking per user, isolated by organization
 */
export class ConversationManager {
  /**
   * Loads or creates a lead by handle and platform, scoped to an org_id
   */
  static async getLeadByHandle(
    handle: string,
    platform: string,
    orgId: string,
  ): Promise<Lead> {
    let lead = await prisma.lead.findFirst({
      where: { handle, platform, org_id: orgId },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          org_id: orgId,
          handle,
          platform: platform as any,
          conversation_history: [],
          lead_stage: "new",
        },
      });
      logger.info(`Created new lead for ${handle} on ${platform} (Org: ${orgId}).`);
    }

    return lead;
  }

  /**
   * Append a message to the conversation history
   */
  static async addMessage(
    leadId: string,
    sender: "user" | "ai",
    text: string,
  ): Promise<Lead> {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new Error("Lead not found");

    const history = (lead.conversation_history as any[]) || [];
    const updatedHistory = [
      ...history,
      { sender, text, timestamp: new Date().toISOString() },
    ];

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        conversation_history: updatedHistory as any,
        last_interaction: new Date(),
      },
    });

    return updatedLead;
  }

  /**
   * Update lead metadata
   */
  static async updateMetadata(
    leadId: string,
    metadata: Partial<Lead>,
  ): Promise<Lead> {
    const { id, created_at, updated_at, org_id, ...data } = metadata;
    return await prisma.lead.update({
      where: { id: leadId },
      data: data as any,
    });
  }

  /**
   * Gets conversation history for LLM context
   */
  static async getHistory(leadId: string): Promise<any[]> {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    return (lead?.conversation_history as any[]) || [];
  }
}
