import axios from "axios";
import logger from "../logger/logger";

const THREADS_API_URL = "https://graph.threads.net/v1.0";

/**
 * Service to interact with Threads via Meta Graph API
 */
export class ThreadsClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async replyToComment(
    commentId: string,
    text: string,
  ): Promise<boolean> {
    if (!this.token || !commentId || !text) {
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
        access_token: this.token,
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
        access_token: this.token,
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
          console.error("\x1b[31m[THREADS ERROR]\x1b[0m API Access Blocked! Your token may be expired or lack permissions (missing threads_manage_replies).");
        }
      }
      logger.error(`Failed to reply to Threads comment ${commentId}`, {
        error: errorData?.message || error.message,
      });
      return false;
    }
  }

  /**
   * Publishes a new top-level post to Threads.
   * Supports TEXT, IMAGE, and VIDEO media types.
   */
  async publishPost(params: {
    text?: string;
    mediaType?: "TEXT" | "IMAGE" | "VIDEO";
    imageUrl?: string;
    videoUrl?: string;
  }): Promise<string | null> {
    const { text, mediaType = "TEXT", imageUrl, videoUrl } = params;

    if (!this.token) {
      logger.error("Missing Threads credentials for publishing post");
      return null;
    }

    try {
      // --- Step 1: Create a media container (Draft) ---
      const createUrl = `${THREADS_API_URL}/me/threads`;
      const createPayload: any = {
        media_type: mediaType,
        access_token: this.token,
      };

      if (text) createPayload.text = text;
      if (mediaType === "IMAGE" && imageUrl) {
        createPayload.image_url = imageUrl;
        if (imageUrl.includes("localhost") || imageUrl.includes("127.0.0.1") || !imageUrl.startsWith("http")) {
          logger.warn(`Potential issue: imageUrl "${imageUrl}" may not be publicly accessible by Threads API.`);
        }
      }
      if (mediaType === "VIDEO" && videoUrl) {
        createPayload.video_url = videoUrl;
        if (videoUrl.includes("localhost") || videoUrl.includes("127.0.0.1") || !videoUrl.startsWith("http")) {
          logger.warn(`Potential issue: videoUrl "${videoUrl}" may not be publicly accessible by Threads API.`);
        }
      }

      logger.info(`Creating Threads ${mediaType} container...`, {
        imageUrl: createPayload.image_url,
        videoUrl: createPayload.video_url,
      });
      const createResponse = await axios.post(createUrl, createPayload, {
        headers: { "Content-Type": "application/json" },
      });

      const creationId = createResponse.data.id;
      if (!creationId) {
        logger.error("Failed to get creationId from Threads API");
        return null;
      }

      // --- Step 2: Handle processing (Especially for Video) ---
      logger.debug(`Threads media container created: ${creationId}. Processing...`);
      
      let isReady = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isReady && attempts < maxAttempts) {
        attempts++;
        // Minor wait before checking status
        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
          const statusUrl = `${THREADS_API_URL}/${creationId}?fields=status,error_message&access_token=${this.token}`;
          const statusResponse = await axios.get(statusUrl);
          const status = statusResponse.data?.status;

          if (status === "FINISHED") {
            isReady = true;
            logger.debug(`Media container ${creationId} is READY.`);
          } else if (status === "ERROR") {
            const errorMsg = statusResponse.data?.error_message || "Unknown error during processing";
            logger.error(`Threads media processing failed: ${errorMsg}`);
            return null;
          } else {
            logger.debug(`Media container ${creationId} still processing (Status: ${status}). Attempt ${attempts}/${maxAttempts}`);
          }
        } catch (statusError: any) {
          // If status endpoint isn't supported or fails, we might just assume it's ready after a delay for simpler types
          if (mediaType === "TEXT" || mediaType === "IMAGE") {
            isReady = true; 
            break;
          }
          logger.warn(`Could not fetch status for container ${creationId}. Retrying...`);
        }
      }

      if (!isReady && mediaType === "VIDEO") {
        logger.error(`Threads video processing timed out for ${creationId}`);
        return null;
      }

      // --- Step 3: Publish the media container ---
      const publishUrl = `${THREADS_API_URL}/me/threads_publish`;
      const publishPayload = {
        creation_id: creationId,
        access_token: this.token,
      };

      const publishResponse = await axios.post(publishUrl, publishPayload, {
        headers: { "Content-Type": "application/json" },
      });

      const publishedId = publishResponse.data.id;
      logger.info(`Threads post successfully published`, { publishedId });

      return publishedId;
    } catch (error: any) {
      const errorData = error.response?.data?.error || error.response?.data;
      logger.error(`Failed to publish Threads post`, {
        error: errorData?.message || error.message,
        details: errorData,
      });
      return null;
    }
  }

  /**
   * Fetches metadata for a Threads post/media item.
   * Useful for getting the original post text to provide context for AI replies.
   */
  async getThreadContent(mediaId: string): Promise<string> {
    if (!this.token || !mediaId) {
      return "a Threads post";
    }

    try {
      const url = `${THREADS_API_URL}/${mediaId}?fields=text&access_token=${this.token}`;
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
