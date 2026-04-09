import axios from "axios";
import { prisma } from "../db/prisma";
import { encrypt } from "../utils/encryption";
import { MetaUtils } from "../utils/meta";
import logger from "../logger/logger";

const META_API_VERSION = "v25.0";
const META_BASE_URL = "https://graph.facebook.com";

export class AuthService {
  /**
   * Orchestrates the Meta OAuth callback exchange and org data persistence.
   */
  static async handleMetaCallback(code: string, orgId: string): Promise<void> {
    try {
      logger.info(`Starting Meta OAuth callback for org: ${orgId}`);

      // 1. Exchange individual code for short-lived user access token
      const tokenUrl = `${META_BASE_URL}/${META_API_VERSION}/oauth/access_token`;
      const tokenResponse = await axios.get(tokenUrl, {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri: process.env.META_REDIRECT_URI,
          code,
        },
      });

      const shortLivedUserToken = tokenResponse.data.access_token;

      // 2. Exchange for long-lived user access token (optional step depending on your requirements)
      const longLivedResponse = await MetaUtils.getLongLivedToken(shortLivedUserToken);
      const longLivedUserToken = longLivedResponse.access_token;

      // 3. Fetch managed Facebook Pages
      const pages = await MetaUtils.getPages(longLivedUserToken);
      if (pages.length === 0) {
        throw new Error("No Facebook Pages found for this account.");
      }

      // For simplicity, we'll pick the first page (or you can map multiple pages if needed)
      const primaryPage = pages[0];
      const facebookPageId = primaryPage.id;
      const pageAccessToken = primaryPage.access_token; // This will already be long-lived if using long-lived user token

      // 4. Fetch the Instagram Business Account ID associated with the Page
      const instagramUserId = await MetaUtils.getInstagramBusinessAccountId(facebookPageId, pageAccessToken);

      if (!instagramUserId) {
        throw new Error("No Instagram Business Account linked to the Facebook Page.");
      }

      // 5. Store configuration in DB (Encrypted)
      await prisma.aiFunnlConfig.upsert({
        where: { org_id: orgId },
        update: {
          instagram_account_id: instagramUserId,
          facebook_page_id: facebookPageId,
          instagram_access_token: encrypt(pageAccessToken),
          token_expiry: longLivedResponse.expires_in ? new Date(Date.now() + longLivedResponse.expires_in * 1000) : null,
          updated_at: new Date(),
        },
        create: {
          org_id: orgId,
          instagram_account_id: instagramUserId,
          facebook_page_id: facebookPageId,
          instagram_access_token: encrypt(pageAccessToken),
          auto_reply_comments: true,
          auto_reply_dm: true,
        },
      });

      logger.info(`Meta OAuth successful for org ${orgId}. Instagram User ID: ${instagramUserId}`);
    } catch (error: any) {
      logger.error(`Error during Meta OAuth for org ${orgId}: ${error.message}`, {
        stack: error.stack,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Orchestrates the Threads OAuth callback exchange and org data persistence.
   */
  static async handleThreadsCallback(code: string, orgId: string): Promise<void> {
    try {
      logger.info(`Starting Threads OAuth callback for org: ${orgId}`);

      const redirectUri = process.env.THREADS_REDIRECT_URI || "";
      if (!redirectUri) {
        throw new Error("THREADS_REDIRECT_URI implies not configured.");
      }

      // 1. Exchange individual code for short-lived user access token
      const shortLivedUserToken = await MetaUtils.getThreadsShortLivedToken(code, redirectUri);

      // 2. Exchange for long-lived user access token
      // Wait, is it guaranteed? Some API accounts use long lived immediately. Threads does have th_exchange_token
      const longLivedUserToken = await MetaUtils.getThreadsLongLivedToken(shortLivedUserToken);

      // 3. Fetch Threads User
      const threadsUser = await MetaUtils.getThreadsUser(longLivedUserToken);
      if (!threadsUser || !threadsUser.id) {
        throw new Error("Failed to extract Threads User ID from the access token.");
      }

      // 4. Store configuration in DB (Encrypted)
      await prisma.aiFunnlConfig.upsert({
        where: { org_id: orgId },
        update: {
          threads_account_id: threadsUser.id,
          threads_bot_username: threadsUser.username,
          threads_access_token: encrypt(longLivedUserToken),
          updated_at: new Date(),
        },
        create: {
          org_id: orgId,
          threads_account_id: threadsUser.id,
          threads_bot_username: threadsUser.username,
          threads_access_token: encrypt(longLivedUserToken),
          auto_reply_comments: true,
          auto_reply_dm: true,
        },
      });

      logger.info(`Threads OAuth successful for org ${orgId}. Threads User ID: ${threadsUser.id}`);
    } catch (error: any) {
      logger.error(`Error during Threads OAuth for org ${orgId}: ${error.message}`, {
        stack: error.stack,
        response: error.response?.data,
      });
      throw error;
    }
  }
}
