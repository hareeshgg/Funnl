import { Router, Request, Response } from "express";
import { MetaUtils } from "../utils/meta";
import { FunnlService } from "../services/funnl.service";
import logger from "../logger/logger";

const router = Router();

/**
 * Meta Webhook Verification (hub.mode, hub.challenge, hub.verify_token)
 */
router.get("/meta", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      logger.info("Meta Webhook verified successfully.");
      return res.status(200).send(challenge);
    } else {
      logger.warn("Meta Webhook verification failed: Invalid verify token.");
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

/**
 * Meta Webhook Event Receiver
 */
router.post("/meta", async (req: Request, res: Response) => {
  const signature = req.headers["x-hub-signature"] as string;

  // 1. Verify Signature (if enabled)
  if (process.env.NODE_ENV === "production" && signature) {
    const rawBody = JSON.stringify(req.body);
    if (!MetaUtils.verifySignature(rawBody, signature)) {
      logger.error("Meta Webhook: Invalid signature received.");
      return res.sendStatus(401);
    }
  }

  const body = req.body;
  if (!body) return res.status(200).send("No body");

  // --- THREADS NATIVE WEBHOOK FORMAT DETECT ---
  if (Array.isArray(body.values) && body.target_id) {
    for (const val of body.values) {
      if (val.field === "replies" || val.field === "reply" || val.field === "mention" || val.field === "mentions") {
        const payloadValue = val.value;
        const threadsUserId = payloadValue?.root_post?.owner_id || body.target_id;
        
        // Construct an artificial "entry" to trick the standard processor into accepting it
        const artificialEntry = {
          id: threadsUserId,
          time: body.time,
          changes: [
            {
              field: "reply", 
              value: {
                id: payloadValue.id,
                text: payloadValue.text,
                from: { id: payloadValue.username }
              }
            }
          ]
        };

        try {
          // Force platformType = 'threads'
          await FunnlService.processWebhookEvent(threadsUserId, artificialEntry, "threads");
        } catch (err: any) {
          logger.error(`Failed to process native Threads event: ${err.message}`);
        }
      }
    }
    return res.status(200).send("EVENT_RECEIVED");
  }

  // --- STANDARD INSTAGRAM WEBHOOK FORMAT ---
  if (!body.entry || !Array.isArray(body.entry)) {
    return res.status(200).send("No valid entry found"); // Acknowledge Meta anyway
  }

  const platformType = body.object === "threads" ? "threads" : "instagram";

  for (const entry of body.entry) {
    const platformUserId = entry.id; // For both IG and Threads, entry.id is the User ID
    
    // 3. Process Org Event
    try {
      await FunnlService.processWebhookEvent(platformUserId, entry, platformType);
    } catch (err: any) {
      logger.error(`Failed to process event for ${platformType} User ID ${platformUserId}: ${err.message}`);
    }
  }

  // 4. Always acknowledge with 200 to Meta
  res.status(200).send("EVENT_RECEIVED");
});

// Aliases for Instagram and Facebook specific webhooks
router.post("/instagram", (req, res) => res.redirect(307, "/webhooks/meta"));
router.post("/facebook", (req, res) => res.redirect(307, "/webhooks/meta"));
router.post("/threads/comments", (req, res) => res.redirect(307, "/webhooks/meta"));
router.get("/instagram", (req, res) => res.redirect(307, "/webhooks/meta"));
router.get("/facebook", (req, res) => res.redirect(307, "/webhooks/meta"));

export default router;
