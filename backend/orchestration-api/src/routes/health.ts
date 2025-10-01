import { Router } from "express";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        api: "running",
        gemini: process.env.GEMINI_API_KEY ? "configured" : "not_configured",
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      services: {
        api: "running",
      },
    });
  }
});

export { router as healthRouter };
