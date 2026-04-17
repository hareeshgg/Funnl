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

  /**
   * Search for a hashtag ID by its name
   * @param hashtagName The name of the hashtag (without #)
   * @param igUserId The Instagram Business Account ID
   */
  async getHashtagId(hashtagName: string, igUserId: string): Promise<string | null> {
    if (!this.token || !igUserId) {
      logger.error("Missing token or igUserId for hashtag search");
      return null;
    }

    try {
      const url = `${META_API_URL}/ig_hashtag_search`;
      const response = await axios.get(url, {
        params: {
          user_id: igUserId,
          q: hashtagName.replace('#', '')
        },
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      const data = response.data.data;
      if (data && data.length > 0) {
        return data[0].id;
      }
      return null;
    } catch (error: any) {
      logger.error(`Failed to get hashtag ID for ${hashtagName}`, { error: error.response?.data || error.message });
      return null;
    }
  }

  /**
   * Get recent or top media for a specific hashtag
   * @param hashtagId The ID of the hashtag
   * @param igUserId The Instagram Business Account ID
   * @param type 'top_media' or 'recent_media'
   * @param limit Number of posts to fetch
   */
  async getMediaByHashtag(hashtagId: string, igUserId: string, type: 'top_media' | 'recent_media' = 'top_media', limit: number = 50): Promise<any[]> {
    if (!this.token || !igUserId) {
      return [];
    }

    try {
      const url = `${META_API_URL}/${hashtagId}/${type}`;
      const response = await axios.get(url, {
        params: {
          user_id: igUserId,
          fields: 'id,caption,media_url,permalink,comments_count,like_count,media_type,timestamp',
          limit: limit
        },
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      return response.data.data || [];
    } catch (error: any) {
      logger.error(`Failed to fetch media for hashtag ${hashtagId}`, { error: error.response?.data || error.message });
      return [];
    }
  }

  /**
   * Post a new top-level comment on a media object
   * @param mediaId The Instagram Media ID
   * @param text The comment text
   */
  async postCommentOnMedia(mediaId: string, text: string): Promise<boolean> {
    if (!this.token || !mediaId) {
      return false;
    }

    try {
      const url = `${META_API_URL}/${mediaId}/comments`;
      const response = await axios.post(url, { message: text }, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
      });

      logger.info(`Successfully posted comment on media ${mediaId}`, { commentId: response.data.id });
      return true;
    } catch (error: any) {
      logger.error(`Failed to post comment on media ${mediaId}`, { error: error.response?.data || error.message });
      return false;
    }
  }
}
