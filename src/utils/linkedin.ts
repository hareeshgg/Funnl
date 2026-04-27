import axios from "axios";
import logger from "../logger/logger";

const LINKEDIN_API_VERSION = "202405";
const LINKEDIN_API_BASE = "https://api.linkedin.com";

/**
 * LinkedIn API Utility Class
 * Handles all direct LinkedIn API interactions.
 */
export class LinkedInUtils {
  /**
   * Constructs the LinkedIn OAuth 2.0 authorization URL.
   */
  static getAuthorizationUrl(orgId: string): string {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error("LINKEDIN_CLIENT_ID or LINKEDIN_REDIRECT_URI is not configured.");
    }

    const scopes = ["openid", "profile", "email", "w_member_social"].join(" ");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state: orgId,
      scope: scopes,
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for an access token.
   */
  static async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    const response = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID || "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI || "",
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    return response.data;
  }

  /**
   * Fetches the authenticated user's profile via OpenID Connect userinfo endpoint.
   * Returns: sub (person URN ID), name, picture, email.
   */
  static async getUserProfile(accessToken: string): Promise<{
    sub: string;
    name: string;
    picture?: string;
    email?: string;
  }> {
    const response = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  }

  /**
   * Registers an image upload with LinkedIn (step 1 of image posting).
   * Returns the upload URL and the image URN.
   */
  static async registerImageUpload(
    accessToken: string,
    personUrn: string
  ): Promise<{ uploadUrl: string; imageUrn: string }> {
    const response = await axios.post(
      `${LINKEDIN_API_BASE}/rest/images?action=initializeUpload`,
      {
        initializeUploadRequest: {
          owner: personUrn,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": LINKEDIN_API_VERSION,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      }
    );

    const uploadData = response.data.value;
    return {
      uploadUrl: uploadData.uploadUrl,
      imageUrn: uploadData.image,
    };
  }

  /**
   * Uploads the raw image binary to LinkedIn's asset server (step 2 of image posting).
   */
  static async uploadImageBinary(
    uploadUrl: string,
    imageBuffer: Buffer,
    accessToken: string
  ): Promise<void> {
    await axios.put(uploadUrl, imageBuffer, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  }

  /**
   * Creates a text-only post on LinkedIn.
   */
  static async createTextPost(
    accessToken: string,
    personUrn: string,
    text: string
  ): Promise<{ postUrn: string }> {
    const response = await axios.post(
      `${LINKEDIN_API_BASE}/rest/posts`,
      {
        author: personUrn,
        commentary: text,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": LINKEDIN_API_VERSION,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      }
    );

    // LinkedIn returns the post URN in the x-restli-id header
    const postUrn = response.headers["x-restli-id"] || response.data?.id || "";
    return { postUrn };
  }

  /**
   * Creates an image post on LinkedIn.
   */
  static async createImagePost(
    accessToken: string,
    personUrn: string,
    text: string,
    imageUrn: string
  ): Promise<{ postUrn: string }> {
    const response = await axios.post(
      `${LINKEDIN_API_BASE}/rest/posts`,
      {
        author: personUrn,
        commentary: text,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          media: {
            id: imageUrn,
          },
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": LINKEDIN_API_VERSION,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      }
    );

    const postUrn = response.headers["x-restli-id"] || response.data?.id || "";
    return { postUrn };
  }

  /**
   * Creates a link/article post on LinkedIn.
   */
  static async createLinkPost(
    accessToken: string,
    personUrn: string,
    text: string,
    linkUrl: string
  ): Promise<{ postUrn: string }> {
    const response = await axios.post(
      `${LINKEDIN_API_BASE}/rest/posts`,
      {
        author: personUrn,
        commentary: text,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          article: {
            source: linkUrl,
          },
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "LinkedIn-Version": LINKEDIN_API_VERSION,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
      }
    );

    const postUrn = response.headers["x-restli-id"] || response.data?.id || "";
    return { postUrn };
  }
}
