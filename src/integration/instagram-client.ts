import axios from "axios";
import logger from "../logger/logger";

const META_API_URL = "https://graph.facebook.com/v21.0";

/**
 * Service to interact with the Instagram Graph API
 */
export class InstagramClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Sends a text message to a user on Instagram
   * @param recipientId The Instagram-scoped ID of the user
   * @param text The message text to send
   */
  async sendTextMessage(recipientId: string, text: string): Promise<boolean> {
    if (!this.token) {
      logger.error("Missing Instagram access token for DM");
      return false;
    }

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
          Authorization: `Bearer ${this.token}`,
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

  /**
   * Replies publicly to an Instagram comment
   * @param commentId The ID of the comment to reply to
   * @param text The reply text
   */
  async replyToComment(commentId: string, text: string): Promise<boolean> {
    if (!this.token || !commentId) {
      logger.error("Missing Instagram access token or commentId for public reply");
      return false;
    }

    try {
      const url = `${META_API_URL}/${commentId}/replies`;
      const payload = { message: text };

      const response = await axios.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
      });

      logger.info(`Successfully replied to comment ${commentId}`, { replyId: response.data.id });
      return true;

    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      logger.error(`Failed to reply to comment ${commentId}`, { error: errorMsg });
      return false;
    }
  }
}
