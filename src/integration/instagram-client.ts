import axios from "axios";
import logger from "../logger/logger";

const META_API_URL = "https://graph.facebook.com/v21.0";

/**
 * Service to interact with the Instagram Graph API
 */
export class InstagramClient {
  /**
   * Sends a text message to a user on Instagram
   * @param recipientId The Instagram-scoped ID of the user
   * @param text The message text to send
   */
  static async sendTextMessage(recipientId: string, text: string): Promise<boolean> {
    const pageId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
    const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN?.trim();
    const fbPageId = process.env.FACEBOOK_PAGE_ID?.trim();

    if (!token || (!pageId && !fbPageId)) {
      logger.error("Missing Instagram credentials (TOKEN and at least one ID are required)");
      return false;
    }

    // Masked log for debugging
    logger.info(`Using Instagram Token (length: ${token.length}, prefix: ${token.substring(0, 10)}...)`);

    // Using /me/messages is the safest way to ensure we are using the Page ID associated with the token
    try {
      const url = `${META_API_URL}/me/messages`;
      
      const payload = {
        recipient: { id: recipientId },
        message: { text: text },
        messaging_type: "RESPONSE",
      };

      const response = await axios.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      logger.info(`Successfully sent message to ${recipientId}`, { messageId: response.data.message_id });
      return true;

    } catch (error: any) {
      if (error.response?.data) {
        logger.error(`Meta API Error Details: ${JSON.stringify(error.response.data)}`);
      }
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`Failed to send message to ${recipientId} via Meta API`, { error: errorMsg });
      return false;
    }
  }
}
