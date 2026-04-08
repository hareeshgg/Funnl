import dotenv from "dotenv";
dotenv.config();
import express from "express";
import authRoutes from "./routes/auth.routes";
import webhookRoutes from "./routes/webhook.routes";
import funnlRoutes from "./routes/funnl.routes";
import logger from "./logger/logger";
import { prisma } from "./db/prisma";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Multi-tenant Routes ---
logger.info("Mounting Multi-tenant API routes...");
app.use("/auth", authRoutes); // Auth flow (OAuth)
app.use("/webhooks", webhookRoutes); // Unified webhook receiver
app.use("/funnl", funnlRoutes); // UI Config & Status

/**
 * Status endpoint to verify system health
 */
app.get("/status", async (req, res) => {
  try {
    // Quick DB check
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "online",
      service: "AI Social Agent Backend",
      multi_tenant: true,
      database: "connected"
    });
  } catch (err) {
    res.status(500).json({ status: "degraded", database: "disconnected" });
  }
});

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    logger.error("Unhandled express error", {
      error: err?.message || err,
      route: req.originalUrl,
      stack: err.stack
    });
    res.status(500).json({ error: "Internal server error" });
  },
);

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { reason, promise });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { error: err.message, stack: err.stack });
});

app.listen(PORT, () => {
  console.log(`\x1b[32m[SERVER READY]\x1b[0m AI Social Agent Backend running on http://localhost:${PORT}`);
  logger.info(`Server started on port ${PORT}`);
});
