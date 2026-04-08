import { Router, Request, Response } from "express";
import { prisma } from "../db/prisma";
import logger from "../logger/logger";

const router = Router();

/**
 * GET /funnl/config
 * Returns current org configuration (filtering out encrypted tokens)
 */
router.get("/config", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string || req.query.org_id as string;

  if (!orgId) {
    return res.status(400).json({ error: "org_id is required in header x-org-id or query." });
  }

  try {
    const config = await prisma.aiFunnlConfig.findUnique({
      where: { org_id: orgId },
    });

    if (!config) {
      return res.status(404).json({ error: "Config not found for this organization." });
    }

    // Filter out sensitive fields
    const { 
      instagram_access_token, 
      threads_access_token, 
      refresh_token, 
      gemini_api_key, 
      ...safeConfig 
    } = config;

    res.status(200).json(safeConfig);
  } catch (error: any) {
    logger.error(`Error fetching config for org ${orgId}: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /funnl/config
 * Updates organization settings (toggles, prompts, etc.)
 */
router.post("/config", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string || req.body.org_id as string;
  const { auto_reply_comments, auto_reply_dm, custom_prompt } = req.body;

  if (!orgId) {
    return res.status(400).json({ error: "org_id is required." });
  }

  try {
    const updatedConfig = await prisma.aiFunnlConfig.update({
      where: { org_id: orgId },
      data: {
        auto_reply_comments: typeof auto_reply_comments === "boolean" ? auto_reply_comments : undefined,
        auto_reply_dm: typeof auto_reply_dm === "boolean" ? auto_reply_dm : undefined,
        custom_prompt: custom_prompt !== undefined ? custom_prompt : undefined,
      },
    });

    res.status(200).json({ success: true, config: updatedConfig });
  } catch (error: any) {
    logger.error(`Error updating config for org ${orgId}: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /funnl/status
 * Returns connection status and feature availability per org
 */
router.get("/status", async (req: Request, res: Response) => {
  const orgId = req.headers["x-org-id"] as string || req.query.org_id as string;

  if (!orgId) {
    return res.status(400).json({ error: "org_id is required." });
  }

  try {
    const config = await prisma.aiFunnlConfig.findUnique({
      where: { org_id: orgId },
    });

    if (!config) {
      return res.status(404).json({ status: "disconnected", error: "No configuration found." });
    }

    const instagramConnected = !!config.instagram_access_token;
    const threadsConnected = !!config.threads_access_token;
    
    res.status(200).json({
      status: (instagramConnected || threadsConnected) ? "connected" : "disconnected",
      metaStatus: instagramConnected ? "connected" : "disconnected",
      threadsStatus: threadsConnected ? "connected" : "disconnected",
      features: {
        auto_reply_comments: config.auto_reply_comments,
        auto_reply_dm: config.auto_reply_dm,
      },
      instagramUserId: config.instagram_account_id,
      threadsUserId: config.threads_account_id,
      updated_at: config.updated_at,
    });
  } catch (error: any) {
    logger.error(`Error fetching status for org ${orgId}: ${error.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
