import { Router, Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { LinkedInService } from "../services/linkedin.service";
import { LinkedInUtils } from "../utils/linkedin";
import logger from "../logger/logger";

const router = Router();

/**
 * Route to generate the Meta OAuth URL.
 * The org_id should be provided in the query string and passed as state.
 */
router.get("/meta", (req: Request, res: Response) => {
  const { org_id } = req.query;

  if (!org_id) {
    return res.status(400).json({ error: "org_id is required" });
  }

  const scopes = [
    "instagram_manage_messages",
    "instagram_manage_comments",
    "instagram_basic",
    "business_management",
    "pages_show_list",
    "pages_read_engagement"
  ].join(",");

  const metaAuthUrl = `https://www.facebook.com/v20.0/dialog/oauth?` +
    `client_id=${process.env.META_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.META_REDIRECT_URI || "")}` +
    `&state=${org_id}` +
    `&scope=${scopes}`;

  res.redirect(metaAuthUrl);
});

/**
 * Meta OAuth callback handler.
 */
router.get("/meta/callback", async (req: Request, res: Response) => {
  const { code, state: orgId, error } = req.query;

  if (error) {
    logger.error(`Meta OAuth callback error: ${error}`);
    return res.status(400).json({ error: `OAuth error: ${error}` });
  }

  if (!code || !orgId) {
    return res.status(400).json({ error: "code and state (org_id) are required" });
  }

  try {
    await AuthService.handleMetaCallback(code as string, orgId as string);
    res.status(200).json({ success: true, message: "Authentication successful" });
  } catch (err: any) {
    logger.error(`Failed during Meta OAuth callback: ${err.message}`);
    res.status(500).json({ success: false, error: "Internal server error during auth" });
  }
});

/**
 * Route to generate the Threads OAuth URL.
 */
router.get("/threads", (req: Request, res: Response) => {
  const { org_id } = req.query;

  if (!org_id) {
    return res.status(400).json({ error: "org_id is required" });
  }

  const scopes = [
    "threads_basic",
    "threads_manage_replies"
  ].join(",");

  const threadsAuthUrl = `https://threads.net/oauth/authorize?` +
    `client_id=${process.env.THREADS_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.THREADS_REDIRECT_URI || "")}` +
    `&state=${org_id}` +
    `&scope=${scopes}` +
    `&response_type=code`;

  res.redirect(threadsAuthUrl);
});

/**
 * Threads OAuth callback handler.
 */
router.get("/threads/callback", async (req: Request, res: Response) => {
  const { code, state: orgId, error } = req.query;

  if (error) {
    logger.error(`Threads OAuth callback error: ${error}`);
    return res.status(400).json({ error: `OAuth error: ${error}` });
  }

  if (!code || !orgId) {
    return res.status(400).json({ error: "code and state (org_id) are required" });
  }

  try {
    await AuthService.handleThreadsCallback(code as string, orgId as string);
    res.status(200).json({ success: true, message: "Threads Authentication successful" });
  } catch (err: any) {
    logger.error(`Failed during Threads OAuth callback: ${err.message}`);
    res.status(500).json({ success: false, error: "Internal server error during auth" });
  }
});

/**
 * Route to generate the LinkedIn OAuth URL.
 */
router.get("/linkedin", (req: Request, res: Response) => {
  const { org_id } = req.query;

  if (!org_id) {
    return res.status(400).json({ error: "org_id is required" });
  }

  try {
    const url = LinkedInUtils.getAuthorizationUrl(org_id as string);
    res.json({ url });
  } catch (err: any) {
    logger.error(`Failed to generate LinkedIn auth URL: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * LinkedIn OAuth callback handler.
 * After successful auth, renders an HTML page that signals success and auto-closes.
 */
router.get("/linkedin/callback", async (req: Request, res: Response) => {
  const { code, state: orgId, error, error_description } = req.query;

  if (error) {
    logger.error(`LinkedIn OAuth callback error: ${error} - ${error_description}`);
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h2>❌ LinkedIn Authorization Failed</h2>
        <p>${error_description || error}</p>
        <p>You can close this window and try again.</p>
      </body></html>
    `);
  }

  if (!code || !orgId) {
    return res.status(400).json({ error: "code and state (org_id) are required" });
  }

  try {
    await LinkedInService.handleCallback(code as string, orgId as string);
    res.status(200).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h2>✅ LinkedIn Connected Successfully</h2>
        <p>You can close this window and return to Sales Command Centre.</p>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body></html>
    `);
  } catch (err: any) {
    logger.error(`Failed during LinkedIn OAuth callback: ${err.message}`);
    res.status(500).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
        <h2>❌ Connection Failed</h2>
        <p>${err.message}</p>
        <p>You can close this window and try again.</p>
      </body></html>
    `);
  }
});

/**
 * Returns the LinkedIn connection status for an org.
 */
router.get("/linkedin/status", async (req: Request, res: Response) => {
  const { org_id } = req.query;

  if (!org_id) {
    return res.status(400).json({ error: "org_id is required" });
  }

  try {
    const status = await LinkedInService.getConnectionStatus(org_id as string);
    res.json(status);
  } catch (err: any) {
    logger.error(`Failed to get LinkedIn status: ${err.message}`);
    res.status(500).json({ error: "Failed to get LinkedIn status" });
  }
});

export default router;

