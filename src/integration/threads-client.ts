import axios from "axios";
import logger from "../logger/logger";

const THREADS_API_URL = "https://graph.threads.net/v1.0";

/**
 * Service to interact with Threads via Meta Graph API
 */
export class ThreadsClient {
  static async replyToComment(
    commentId: string,
    text: string,
  ): Promise<boolean> {
    const token =
      process.env.THREADS_ACCESS_TOKEN?.trim() ||
      process.env.INSTAGRAM_PAGE_ACCESS_TOKEN?.trim();

    if (!token || !commentId || !text) {
      logger.error("Missing Threads credentials or comment payload");
      return false;
    }

    logger.info(`Replying to Threads comment ${commentId}`, {
      text: text.slice(0, 100),
    });

    try {
      // --- Step 1: Create a media container (Draft) ---
      const createUrl = `${THREADS_API_URL}/me/threads`;
      const createPayload = {
        media_type: "TEXT",
        text: text,
        reply_to_id: commentId,
        access_token: token,
      };

      const createResponse = await axios.post(createUrl, createPayload, {
        headers: { "Content-Type": "application/json" },
      });

      const creationId = createResponse.data.id;
      if (!creationId) {
        logger.error("Failed to get creationId from Threads API");
        return false;
      }

      logger.debug(`Threads media container created: ${creationId}. Waiting for propagation...`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // --- Step 2: Publish the media container ---
      const publishUrl = `${THREADS_API_URL}/me/threads_publish`;
      const publishPayload = {
        creation_id: creationId,
        access_token: token,
      };

      const publishResponse = await axios.post(publishUrl, publishPayload, {
        headers: { "Content-Type": "application/json" },
      });

      const publishedId = publishResponse.data.id;

      logger.info(`Threads reply successfully published`, {
        commentId,
        publishedId,
      });

      return true;
    } catch (error: any) {
      const errorData = error.response?.data?.error || error.response?.data;
      if (errorData) {
        logger.error(`Threads API error`, { details: errorData });
        
        // Highlight API Blocked errors directly in console for developer
        if (errorData.message?.includes("API access blocked")) {
          console.error("\x1b[31m[THREADS ERROR]\x1b[0m API Access Blocked! Your THREADS_ACCESS_TOKEN may be expired or lack permissions (missing threads_manage_replies).");
        }
      }
      logger.error(`Failed to reply to Threads comment ${commentId}`, {
        error: errorData?.message || error.message,
      });
      return false;
    }
  }

  /**
   * Fetches metadata for a Threads post/media item.
   * Useful for getting the original post text to provide context for AI replies.
   */
  static async getThreadContent(mediaId: string): Promise<string> {
    const token =
      process.env.THREADS_ACCESS_TOKEN?.trim() ||
      process.env.INSTAGRAM_PAGE_ACCESS_TOKEN?.trim();

    if (!token || !mediaId) {
      return "a Threads post";
    }

    try {
      const url = `${THREADS_API_URL}/${mediaId}?fields=text&access_token=${token}`;
      const response = await axios.get(url);
      return response.data?.text || "a Threads post";
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      logger.error(`Failed to fetch Threads content for ${mediaId}`, {
        error: errorMessage,
      });

      if (errorMessage?.includes("API access blocked")) {
        console.error("\x1b[33m[THREADS WARNING]\x1b[0m Cannot fetch thread context. API Access Blocked!");
      }

      return "a Threads post";
    }
  }
}
