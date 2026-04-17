import express from "express";
import { ProactiveService } from "../services/proactive.service";
import logger from "../logger/logger";
import { prisma } from "../db/prisma";

const router = express.Router();

/**
 * Creates a new category and returns generated queries (keywords, hashtags, intent)
 */
router.post("/categories", async (req, res) => {
  try {
    const { org_id, name } = req.body;
    if (!org_id || !name) {
      return res.status(400).json({ error: "Missing org_id or name" });
    }

    const category = await ProactiveService.createCategory(org_id, name);
    res.status(201).json(category);
  } catch (err: any) {
    logger.error("Failed to create proactive category", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Run a discovery iteration to fetch and rank posts
 */
router.post("/discover", async (req, res) => {
  try {
    const { org_id, category_id } = req.body;
    if (!org_id || !category_id) {
      return res.status(400).json({ error: "Missing org_id or category_id" });
    }

    const results = await ProactiveService.runDiscoveryIteration(org_id, category_id);
    res.json({ message: "Discovery iteration complete.", results });
  } catch (err: any) {
    logger.error("Failed to run discovery iteration", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Gets all categories
 */
router.get("/categories/:org_id", async (req, res) => {
  try {
    const { org_id } = req.params;
    const categories = await prisma.proactive_categories.findMany({
      where: { org_id }
    });
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get all posts and their engagement logs for the UI
 */
router.get("/posts/:org_id", async (req, res) => {
  try {
    const { org_id } = req.params;
    const posts = await prisma.proactive_posts.findMany({
      where: { category: { org_id } },
      include: {
        engagement_logs: true,
        category: true
      },
      orderBy: { created_at: 'desc' }
    });
    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
