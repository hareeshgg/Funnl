import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { InstagramListener } from "./listener/instagram-listener";
import { Humanizer } from "./humanizer/humanizer-logic";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// --- Core Webhook Routes ---

/**
 * IG Webhook Verification (Standard Meta Webhook challenge)
 */
app.get("/webhooks/instagram", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      console.log("Instagram Webhook verified.");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

/**
 * Handle incoming Instagram Messages (DMs)
 */
app.post("/webhooks/instagram/dm", InstagramListener.handleDM);

/**
 * Handle Instagram Post Comments (Comment-to-DM Funnel)
 */
app.post("/webhooks/instagram/comments", InstagramListener.handleComment);

// --- Threads Routes ---

/**
 * Handle incoming Threads Mentions / Replies
 */
import { ThreadsListener } from "./listener/threads-listener";
app.post("/webhooks/threads/mentions", ThreadsListener.handleMention);

/**
 * Create an Automated Threads Post 
 */
app.post("/threads/post", ThreadsListener.createPost);

// --- POC Testing & Monitoring ---

/**
 * Status endpoint to verify POC connectivity
 */
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    agent: "AI Social Agent (Sales Command POC)",
    capabilities: ["Instagram DMs", "Comment Funnel", "Threads Integration (Draft)"],
  });
});

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
       await InstagramListener.handleDM({ body: session } as any, { 
         status: () => ({ send: () => {} }) 
       } as any);
       return session.senderId;
    })
  );

  res.json({
    message: "Concurrency test initiated for 50 sessions.",
    total_sessions: sessions.length,
    successful_dispatches: results.filter(r => r.status === "fulfilled").length,
  });
});

app.listen(PORT, () => {
  console.log(`AI Social Agent (Sales Command POC) running on port ${PORT}`);
});
