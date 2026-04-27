import { Router, Request, Response } from "express";
import { LinkedInService } from "../services/linkedin.service";
import logger from "../logger/logger";
import multer from "multer";

const router = Router();

// Configure multer for image uploads (8MB limit, images only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG and PNG images are allowed."));
    }
  },
});

/**
 * POST /linkedin/posts/text
 * Create a text-only LinkedIn post.
 */
router.post("/posts/text", async (req: Request, res: Response) => {
  const { org_id, text } = req.body;

  if (!org_id || !text) {
    return res.status(400).json({ error: "org_id and text are required" });
  }

  if (text.length > 3000) {
    return res.status(400).json({ error: "Post text cannot exceed 3000 characters" });
  }

  try {
    const result = await LinkedInService.createTextPost(org_id as string, text);
    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error(`LinkedIn text post error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: err.message,
      details: err.response?.data,
    });
  }
});

/**
 * POST /linkedin/posts/image
 * Create an image post on LinkedIn (multipart form).
 * Fields: org_id, text | File: image
 */
router.post("/posts/image", upload.single("image"), async (req: Request, res: Response) => {
  const { org_id, text } = req.body;

  if (!org_id || !text) {
    return res.status(400).json({ error: "org_id and text are required" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "An image file is required" });
  }

  try {
    const result = await LinkedInService.createImagePost(
      org_id as string,
      text,
      req.file.buffer,
      req.file.mimetype
    );
    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error(`LinkedIn image post error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: err.message,
      details: err.response?.data,
    });
  }
});

/**
 * POST /linkedin/posts/link
 * Create a link/article post on LinkedIn.
 */
router.post("/posts/link", async (req: Request, res: Response) => {
  const { org_id, text, link_url } = req.body;

  if (!org_id || !text || !link_url) {
    return res.status(400).json({ error: "org_id, text, and link_url are required" });
  }

  try {
    const result = await LinkedInService.createLinkPost(org_id as string, text, link_url);
    res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error(`LinkedIn link post error: ${err.message}`);
    res.status(500).json({
      success: false,
      error: err.message,
      details: err.response?.data,
    });
  }
});

/**
 * GET /linkedin/posts/:org_id
 * Get post history for an org.
 */
router.get("/posts/:org_id", async (req: Request, res: Response) => {
  const { org_id } = req.params;

  try {
    const posts = await LinkedInService.getPostHistory(org_id as string);
    res.json({ success: true, data: posts });
  } catch (err: any) {
    logger.error(`LinkedIn post history error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /linkedin/disconnect
 * Disconnect a LinkedIn account.
 */
router.post("/disconnect", async (req: Request, res: Response) => {
  const { org_id } = req.body;

  if (!org_id) {
    return res.status(400).json({ error: "org_id is required" });
  }

  try {
    await LinkedInService.disconnectAccount(org_id as string);
    res.json({ success: true, message: "LinkedIn account disconnected" });
  } catch (err: any) {
    logger.error(`LinkedIn disconnect error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
