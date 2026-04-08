import crypto from "crypto";
import axios from "axios";
import logger from "../logger/logger";

const META_API_VERSION = "v25.0";
const META_BASE_URL = "https://graph.facebook.com";

export class MetaUtils {
  /**
   * Verifies the Meta X-Hub-Signature header.
   */
  static verifySignature(payload: string, signature: string): boolean {
    const secret = process.env.META_VERIFY_SECRET;
    if (!secret) {
      logger.error("META_VERIFY_SECRET is not defined in .env");
      return false;
    }

    const [algo, hash] = signature.split("=");
    if (!algo || !hash) return false;

    const hmac = crypto.createHmac("sha1", secret);
    const digest = hmac.update(payload).digest("hex");

    return digest === hash;
  }
  /**
   * Exchanges a short-lived user access token for a long-lived one.
   */
  static async getLongLivedToken(shortLivedToken: string): Promise<{ access_token: string; expires_in?: number }> {
    const url = `${META_BASE_URL}/${META_API_VERSION}/oauth/access_token`;
    const response = await axios.get(url, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    });
    return response.data;
  }

  /**
   * Fetches the list of Facebook Pages managed by the user.
   */
  static async getPages(accessToken: string): Promise<any[]> {
    const url = `${META_BASE_URL}/${META_API_VERSION}/me/accounts`;
    const response = await axios.get(url, {
      params: { access_token: accessToken },
    });
    return response.data.data || [];
  }

  /**
   * Fetches the Instagram Business Account ID associated with a Facebook Page.
   */
  static async getInstagramBusinessAccountId(pageId: string, pageAccessToken: string): Promise<string | null> {
    const url = `${META_BASE_URL}/${META_API_VERSION}/${pageId}`;
    const response = await axios.get(url, {
      params: {
        fields: "instagram_business_account",
        access_token: pageAccessToken,
      },
    });
    return response.data.instagram_business_account?.id || null;
  }

  /**
   * Fetches Page access token for a specific page.
   */
  static async getPageAccessToken(pageId: string, userAccessToken: string): Promise<string | null> {
    const url = `${META_BASE_URL}/${META_API_VERSION}/${pageId}`;
    const response = await axios.get(url, {
      params: {
        fields: "access_token",
        access_token: userAccessToken,
      },
    });
    return response.data.access_token || null;
  }

  /**
   * Fetches the Threads User ID for the authenticated account.
   */
  static async getThreadsUserId(accessToken: string): Promise<string | null> {
    try {
      const url = `https://graph.threads.net/v1.0/me`;
      const response = await axios.get(url, {
        params: {
          fields: "id,username",
          access_token: accessToken,
        },
      });
      return response.data.id || null;
    } catch (err: any) {
      logger.error(`Failed to fetch Threads User ID: ${err.message}`);
      return null;
    }
  }

  /**
   * Exchanges a Threads authorization code for a short-lived access token.
   */
  static async getThreadsShortLivedToken(code: string, redirectUri: string): Promise<string> {
    const url = "https://graph.threads.net/oauth/access_token";
    const formParams = new URLSearchParams({
      client_id: process.env.THREADS_APP_ID || "",
      client_secret: process.env.THREADS_APP_SECRET || "",
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const response = await axios.post(url, formParams.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data.access_token;
  }

  /**
   * Exchanges a Threads short-lived token for a long-lived access token.
   */
  static async getThreadsLongLivedToken(shortToken: string): Promise<string> {
    const url = "https://graph.threads.net/access_token";
    const response = await axios.get(url, {
      params: {
        grant_type: "th_exchange_token",
        client_secret: process.env.THREADS_APP_SECRET,
        access_token: shortToken,
      },
    });
    return response.data.access_token;
  }
}
