import express from "express";
import dotenv from "dotenv";
import { InstagramListener } from "./listener/instagram-listener";
import { ThreadsListener } from "./listener/threads-listener";
import { MessageProcessor } from "./engine/processor";
import { Humanizer } from "./humanizer/humanizer-logic";
import instagramOAuthRouter from "./integration/instagram-oauth";
import logger from "./logger/logger";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Instagram OAuth Routes ---
app.use("/auth/instagram", instagramOAuthRouter);

// --- Core Webhook Routes ---

/**
 * IG Webhook Verification (Standard Meta Webhook challenge)
 */
app.get("/webhooks/instagram", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log("Instagram Webhook verified.");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

/**
 * Handle incoming Instagram Messages (DMs)
 * Meta defaults to sending POST requests to the root webhook URL
 */
app.post("/webhooks/instagram", InstagramListener.handleDM);
app.post("/webhooks/instagram/dm", InstagramListener.handleDM);

/**
 * Handle Instagram Post Comments (Comment-to-DM Funnel)
 */
app.post("/webhooks/instagram/comments", InstagramListener.handleComment);

// --- Threads Routes ---

/**
 * Threads Webhook Verification (Standard Meta webhook challenge)
 */
const threadsVerifyHandler = (req: express.Request, res: express.Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Threads webhook verification attempt", {
    mode,
    token,
    challenge,
  });

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

app.get("/webhooks/threads", threadsVerifyHandler);
app.get("/webhooks/threads/comments", threadsVerifyHandler);
app.get("/webhooks/threads/mentions", threadsVerifyHandler);

/**
 * Handle incoming Threads Mentions / Replies
 */
app.post("/webhooks/threads", ThreadsListener.handleComment); // catches generic thread webhooks too
app.post("/webhooks/threads/mentions", ThreadsListener.handleMention);
app.post("/webhooks/threads/comments", ThreadsListener.handleComment);

/**
 * Create an Automated Threads Post
 */
app.post("/threads/post", ThreadsListener.createPost);

// -- Quick dev/test route for Threads comment automation (no webhook needed) --
app.post("/test/threads/comment", async (req, res) => {
  const { senderId, comment, commentId } = req.body;

  if (!senderId || !comment || !commentId) {
    return res
      .status(400)
      .json({ error: "senderId, comment, and commentId are required" });
  }

  try {
    await MessageProcessor.process(senderId, comment, "threads", commentId);
    return res.json({ success: true, message: "Threads flow triggered" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --- POC Testing & Monitoring ---

/**
 * Status endpoint to verify POC connectivity
 */
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    agent: "AI Social Agent (Sales Command POC)",
    capabilities: [
      "Instagram DMs",
      "Comment Funnel",
      "Threads Integration (Draft)",
    ],
  });
});

// Global error handler to capture uncaught route exceptions
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Global error handler caught an exception", err);
    logger.error("Unhandled express error", {
      error: err?.message || err,
      route: req.originalUrl,
    });
    res.status(500).json({ error: "Internal server error" });
  },
);

/**
 * Concurrency Test Mock
 * Simulates 50 concurrent interactions
 */
app.get("/test/concurrency", async (req, res) => {
  console.log("Starting concurrency test for 50 sessions...");

  const sessions = Array.from({ length: 50 }, (_, i) => ({
    senderId: `user_test_${i}`,
    message: `Hello, I'm interested in learning about pricing for ${i % 2 === 0 ? "individual" : "teams"}.`,
    platform: "instagram",
  }));

  // Simulate concurrent traffic (Non-blocking)
  const results = await Promise.allSettled(
    sessions.map(async (session) => {
      // Mock the POST request internally for the test
      await InstagramListener.handleDM(
        { body: session } as any,
        {
          status: () => ({ send: () => {} }),
        } as any,
      );
      return session.senderId;
    }),
  );

  res.json({
    message: "Concurrency test initiated for 50 sessions.",
    total_sessions: sessions.length,
    successful_dispatches: results.filter((r) => r.status === "fulfilled")
      .length,
  });
});

app.listen(PORT, () => {
  console.log(`AI Social Agent (Sales Command POC) running on port ${PORT}`);
});
