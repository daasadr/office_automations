import { Router } from "express";
import { config } from "../config";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      services: {
        api: "running",
        gemini: config.gemini.apiKey ? "configured" : "not_configured",
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      error: error instanceof Error ? error.message : "Unknown error",
      services: {
        api: "running",
      },
    });
  }
});

export { router as healthRouter };
