import axios from "axios";
import { Prisma } from "@prisma/client";
import dotenv from "dotenv";
import logger from "../logger/logger";

dotenv.config();

const SALES_COMMAND_API_KEY = process.env.SALES_COMMAND_API_KEY;
const SALES_COMMAND_BASE_URL = process.env.SALES_COMMAND_BASE_URL || "https://api.salescommand.com/v1";

export interface SalesCommandLead {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source: string;
  external_id: string;
  tags?: string[];
  notes?: string;
}

/**
 * Client for Sales Command CRM integration
 * Fields mapping per GH Issue #50
 */
export class SalesCommandClient {
  /**
   * Syncs a qualified lead to the CRM
   * @param lead Prisma Lead record
   */
  static async syncLead(lead: any): Promise<boolean> {
    if (!SALES_COMMAND_API_KEY) {
      logger.warn("SALES_COMMAND_API_KEY is not defined in environment.");
      return false;
    }

    // Capture mapping details requested in GH Issue #50
    // Maps handle to firstName as social identifier
    const payload: SalesCommandLead = {
      external_id: lead.id,
      firstName: lead.handle,
      source: `AI Agent (${lead.platform})`,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      notes: `Intent: ${lead.intent}\nLead Stage: ${lead.lead_stage}\nInterest: ${lead.product_interest}\nHandle: @${lead.handle}\nBudget: ${lead.budget || "Not Specified"}\nFull Summary: Convo summary derived from history.`,
      tags: [lead.platform, lead.lead_stage, lead.intent].filter(Boolean) as string[],
    };

    try {
      const response = await axios.post(`${SALES_COMMAND_BASE_URL}/leads`, payload, {
        headers: {
          "Authorization": `Bearer ${SALES_COMMAND_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 201 || response.status === 200) {
        logger.info(`Successfully synced lead ${lead.id} (@${lead.handle}) to Sales Command.`);
        return true;
      }
      return false;
    } catch (error: any) {
      logger.error(`Error syncing lead to Sales Command: ${error.message}`, { 
        response: error.response?.data,
        lead_id: lead.id 
      });
      return false;
    }
  }
}
