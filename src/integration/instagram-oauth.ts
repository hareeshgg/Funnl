import express from "express";
import axios from "axios";

const router = express.Router();

const {
  META_APP_ID,
  META_APP_SECRET,
  META_REDIRECT_URI,
  META_GRAPH_API_VERSION = "v25.0",
} = process.env;

if (!META_APP_ID || !META_APP_SECRET || !META_REDIRECT_URI) {
  console.warn(
    "Missing required Instagram OAuth environment variables. Please set META_APP_ID, META_APP_SECRET, META_REDIRECT_URI.",
  );
}

// In-memory storage (for demo). Replace with DB/KeyVault/Secrets Manager in production.
let storedInstagramToken: {
  access_token: string;
  token_type: string;
  expires_in?: number;
  acquired_at?: string;
  long_lived?: boolean;
} | null = null;

/**
 * Build the permission scope string
 * Required permissions for Instagram Business Messaging use-cases
 */
const INSTAGRAM_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_manage_metadata",
].join(",");

/**
 * Build OAuth authorization URL.
 */
function buildAuthorizationUrl() {
  const base = `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth`;

  const params = new URLSearchParams({
    client_id: META_APP_ID || "",
    redirect_uri: META_REDIRECT_URI || "",
    scope: INSTAGRAM_OAUTH_SCOPES,
    response_type: "code",
  });

  return `${base}?${params.toString()}`;
}

/**
 * Store a token in memory and emit a warning (replace with secure storage in prod)
 */
function storeToken(tokenData: any, longLived = false) {
  storedInstagramToken = {
    access_token: tokenData.access_token,
    token_type: tokenData.token_type,
    expires_in: tokenData.expires_in,
    acquired_at: new Date().toISOString(),
    long_lived: longLived,
  };
}

/**
 * Helper for GET requests that require token
 */
async function fetchWithToken(path: string) {
  if (!storedInstagramToken?.access_token) {
    throw new Error("No access token available. Complete OAuth flow first.");
  }

  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${path}`;
  return axios.get(url, {
    params: {
      access_token: storedInstagramToken.access_token,
    },
  });
}

// ----------------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------------

/**
 * Initiate OAuth login flow.
 * Redirects user to Meta Beach to accept permissions.
 */
router.get("/login", (req, res) => {
  if (!META_APP_ID || !META_REDIRECT_URI || !META_APP_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Missing META_APP_ID, META_APP_SECRET or META_REDIRECT_URI.",
    });
  }

  const redirectUrl = buildAuthorizationUrl();
  return res.redirect(redirectUrl);
});

/**
 * Authorization callback endpoint.
 * Handles ?code=... and upgrades to a page token.
 */
router.get("/callback", async (req, res) => {
  const code = String(req.query.code || "");
  const error = req.query.error;

  if (error) {
    return res.status(400).json({ success: false, error });
  }

  if (!code) {
    return res
      .status(400)
      .json({ success: false, message: "Missing authorization code." });
  }

  try {
    // Exchange the code for a short-lived user access token
    const tokenResponse = await axios.get(
      "https://graph.facebook.com/" +
        META_GRAPH_API_VERSION +
        "/oauth/access_token",
      {
        params: {
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          redirect_uri: META_REDIRECT_URI,
          code,
        },
      },
    );

    const shortLivedToken = tokenResponse.data;
    storeToken(shortLivedToken, false);

    // Upgrade to long-lived token (best practice; token lives ~60 days)
    const longLivedResponse = await axios.get(
      "https://graph.facebook.com/" +
        META_GRAPH_API_VERSION +
        "/oauth/access_token",
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          fb_exchange_token: shortLivedToken.access_token,
        },
      },
    );

    const longLivedToken = longLivedResponse.data;
    storeToken(longLivedToken, true);

    // Fetch user/page info for validation
    const profileRes = await fetchWithToken(
      "me?fields=id,name,instagram_business_account",
    );
    const pagesRes = await fetchWithToken(
      "me/accounts?fields=id,name,instagram_business_account",
    );

    return res.json({
      success: true,
      message: "OAuth complete, token stored.",
      token: {
        ...storedInstagramToken,
      },
      me: profileRes.data,
      pages: pagesRes.data,
    });
  } catch (err: any) {
    console.error(
      "Instagram OAuth callback error: ",
      err.response?.data || err.message,
    );
    return res.status(500).json({
      success: false,
      message: "Instagram OAuth callback failed.",
      error: err.response?.data || err.message,
    });
  }
});

/**
 * Debug route to show stored token and account metadata.
 */
router.get("/status", async (req, res) => {
  if (!storedInstagramToken?.access_token) {
    return res.status(404).json({
      success: false,
      message: "No Instagram access token stored yet.",
    });
  }

  try {
    const me = await fetchWithToken(
      "me?fields=id,name,instagram_business_account",
    );
    const accounts = await fetchWithToken(
      "me/accounts?fields=id,name,instagram_business_account",
    );

    return res.json({
      success: true,
      token: storedInstagramToken,
      me: me.data,
      accounts: accounts.data,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Instagram meta details.",
      error: err.response?.data || err.message,
    });
  }
});

/**
 * Example action call: send a simple message (must have instagram_manage_messages + permissions + app review)
 */
router.post("/send-message", async (req, res) => {
  const { recipientId, text } = req.body;

  if (!recipientId || !text) {
    return res
      .status(400)
      .json({ success: false, message: "recipientId and text required" });
  }

  if (!storedInstagramToken?.access_token) {
    return res
      .status(400)
      .json({
        success: false,
        message: "No stored access token. Authenticate first.",
      });
  }

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text },
        messaging_type: "RESPONSE",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storedInstagramToken.access_token}`,
        },
      },
    );

    return res.json({ success: true, data: response.data });
  } catch (err: any) {
    console.error("Send message error", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send Instagram message.",
      error: err.response?.data || err.message,
    });
  }
});

export default router;
