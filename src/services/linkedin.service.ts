import { prisma } from "../db/prisma";
import { encrypt, decrypt } from "../utils/encryption";
import { LinkedInUtils } from "../utils/linkedin";
import logger from "../logger/logger";

/**
 * LinkedIn Service
 * Handles business logic for LinkedIn connection management and content publishing.
 */
export class LinkedInService {
  /**
   * Handles the OAuth callback: exchanges code for token, fetches profile, stores connection.
   */
  static async handleCallback(code: string, orgId: string): Promise<void> {
    try {
      logger.info(`Starting LinkedIn OAuth callback for org: ${orgId}`);

      // 1. Exchange code for access token
      const tokenData = await LinkedInUtils.exchangeCodeForToken(code);
      const { access_token, expires_in } = tokenData;

      // 2. Fetch user profile
      const profile = await LinkedInUtils.getUserProfile(access_token);
      const personUrn = `urn:li:person:${profile.sub}`;

      // 3. Upsert connection in DB
      await prisma.linkedin_connections.upsert({
        where: { org_id: orgId },
        update: {
          person_urn: personUrn,
          access_token: encrypt(access_token),
          token_expiry: new Date(Date.now() + expires_in * 1000),
          display_name: profile.name || null,
          profile_image: profile.picture || null,
          email: profile.email || null,
          connected_at: new Date(),
          updated_at: new Date(),
        },
        create: {
          org_id: orgId,
          person_urn: personUrn,
          access_token: encrypt(access_token),
          token_expiry: new Date(Date.now() + expires_in * 1000),
          display_name: profile.name || null,
          profile_image: profile.picture || null,
          email: profile.email || null,
        },
      });

      logger.info(`LinkedIn OAuth successful for org ${orgId}. Person URN: ${personUrn}`);
    } catch (error: any) {
      logger.error(`Error during LinkedIn OAuth for org ${orgId}: ${error.message}`, {
        stack: error.stack,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Returns the LinkedIn connection status for an org.
   */
  static async getConnectionStatus(orgId: string): Promise<{
    connected: boolean;
    display_name: string | null;
    profile_image: string | null;
    headline: string | null;
    email: string | null;
    person_urn: string | null;
    token_expired: boolean;
    connected_at: Date | null;
  }> {
    const connection = await prisma.linkedin_connections.findUnique({
      where: { org_id: orgId },
    });

    if (!connection || !connection.access_token) {
      return {
        connected: false,
        display_name: null,
        profile_image: null,
        headline: null,
        email: null,
        person_urn: null,
        token_expired: false,
        connected_at: null,
      };
    }

    const tokenExpired = connection.token_expiry
      ? new Date() > connection.token_expiry
      : false;

    return {
      connected: true,
      display_name: connection.display_name,
      profile_image: connection.profile_image,
      headline: connection.headline,
      email: connection.email,
      person_urn: connection.person_urn,
      token_expired: tokenExpired,
      connected_at: connection.connected_at,
    };
  }

  /**
   * Disconnects a LinkedIn account by removing the connection record.
   */
  static async disconnectAccount(orgId: string): Promise<void> {
    await prisma.linkedin_connections.deleteMany({
      where: { org_id: orgId },
    });
    logger.info(`LinkedIn account disconnected for org ${orgId}`);
  }

  /**
   * Gets the decrypted access token and person URN for an org.
   * Throws if not connected or token is expired.
   */
  private static async getActiveConnection(orgId: string) {
    const connection = await prisma.linkedin_connections.findUnique({
      where: { org_id: orgId },
    });

    if (!connection || !connection.access_token || !connection.person_urn) {
      throw new Error("LinkedIn account is not connected. Please connect first.");
    }

    if (connection.token_expiry && new Date() > connection.token_expiry) {
      throw new Error("LinkedIn access token has expired. Please reconnect your account.");
    }

    return {
      accessToken: decrypt(connection.access_token),
      personUrn: connection.person_urn,
      connectionId: connection.id,
    };
  }

  /**
   * Creates and publishes a text-only post.
   */
  static async createTextPost(orgId: string, text: string): Promise<{ postId: string; postUrn: string }> {
    const { accessToken, personUrn, connectionId } = await this.getActiveConnection(orgId);

    // Create a draft record
    const post = await prisma.linkedin_posts.create({
      data: {
        connection_id: connectionId,
        content_type: "text",
        text_content: text,
        status: "publishing",
      },
    });

    try {
      const result = await LinkedInUtils.createTextPost(accessToken, personUrn, text);

      // Update to published
      await prisma.linkedin_posts.update({
        where: { id: post.id },
        data: {
          status: "published",
          linkedin_post_id: result.postUrn,
          published_at: new Date(),
        },
      });

      logger.info(`LinkedIn text post published for org ${orgId}: ${result.postUrn}`);
      return { postId: post.id, postUrn: result.postUrn };
    } catch (error: any) {
      await prisma.linkedin_posts.update({
        where: { id: post.id },
        data: {
          status: "failed",
          error_message: error.response?.data?.message || error.message,
        },
      });
      logger.error(`LinkedIn text post failed for org ${orgId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates and publishes an image post (3-step flow: register → upload → post).
   */
  static async createImagePost(
    orgId: string,
    text: string,
    imageBuffer: Buffer,
    _mimeType: string
  ): Promise<{ postId: string; postUrn: string }> {
    const { accessToken, personUrn, connectionId } = await this.getActiveConnection(orgId);

    const post = await prisma.linkedin_posts.create({
      data: {
        connection_id: connectionId,
        content_type: "image",
        text_content: text,
        status: "publishing",
      },
    });

    try {
      // Step 1: Register image upload
      const { uploadUrl, imageUrn } = await LinkedInUtils.registerImageUpload(accessToken, personUrn);

      // Step 2: Upload binary
      await LinkedInUtils.uploadImageBinary(uploadUrl, imageBuffer, accessToken);

      // Step 3: Create post with image
      const result = await LinkedInUtils.createImagePost(accessToken, personUrn, text, imageUrn);

      await prisma.linkedin_posts.update({
        where: { id: post.id },
        data: {
          status: "published",
          linkedin_post_id: result.postUrn,
          media_url: imageUrn,
          published_at: new Date(),
        },
      });

      logger.info(`LinkedIn image post published for org ${orgId}: ${result.postUrn}`);
      return { postId: post.id, postUrn: result.postUrn };
    } catch (error: any) {
      await prisma.linkedin_posts.update({
        where: { id: post.id },
        data: {
          status: "failed",
          error_message: error.response?.data?.message || error.message,
        },
      });
      logger.error(`LinkedIn image post failed for org ${orgId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates and publishes a link/article post.
   */
  static async createLinkPost(
    orgId: string,
    text: string,
    linkUrl: string
  ): Promise<{ postId: string; postUrn: string }> {
    const { accessToken, personUrn, connectionId } = await this.getActiveConnection(orgId);

    const post = await prisma.linkedin_posts.create({
      data: {
        connection_id: connectionId,
        content_type: "link",
        text_content: text,
        link_url: linkUrl,
        status: "publishing",
      },
    });

    try {
      const result = await LinkedInUtils.createLinkPost(accessToken, personUrn, text, linkUrl);

      await prisma.linkedin_posts.update({
        where: { id: post.id },
        data: {
          status: "published",
          linkedin_post_id: result.postUrn,
          published_at: new Date(),
        },
      });

      logger.info(`LinkedIn link post published for org ${orgId}: ${result.postUrn}`);
      return { postId: post.id, postUrn: result.postUrn };
    } catch (error: any) {
      await prisma.linkedin_posts.update({
        where: { id: post.id },
        data: {
          status: "failed",
          error_message: error.response?.data?.message || error.message,
        },
      });
      logger.error(`LinkedIn link post failed for org ${orgId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Returns the recent post history for an org.
   */
  static async getPostHistory(orgId: string, limit: number = 20) {
    const connection = await prisma.linkedin_connections.findUnique({
      where: { org_id: orgId },
    });

    if (!connection) return [];

    return prisma.linkedin_posts.findMany({
      where: { connection_id: connection.id },
      orderBy: { created_at: "desc" },
      take: limit,
    });
  }
}
