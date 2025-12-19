// Initialize Sentry first, before any other imports
import { initializeSentry } from "./lib/sentry";
initializeSentry();

import express from "express";
import * as Sentry from "@sentry/node";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { config } from "./config";
import { logger } from "./utils/logger";
import { healthRouter } from "./routes/health";
import { documentRouter } from "./routes/documents";
import { workflowRouter } from "./routes/workflows";
import { logisticsRouter } from "./routes/logistics";
import { errorHandler } from "./middleware/errorHandler";
import { swaggerSpec } from "./lib/swagger";

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);

// Body parsing middleware (50mb for logistics large PDFs)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve OpenAPI spec as JSON
app.get("/openapi.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Routes
app.use("/health", healthRouter);
app.use("/documents", documentRouter);
app.use("/workflows", workflowRouter);
app.use("/logistics", logisticsRouter);

// Sentry error handler must be registered before other error handlers
Sentry.setupExpressErrorHandler(app);

// Error handling
app.use(errorHandler);

// 404 handler
app.use("*", (_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

async function startServer() {
  try {
    const server = app.listen(config.port, () => {
      logger.info(`Orchestration API server running on port ${config.port}`);
    });

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down gracefully");
      server.close(() => {
        process.exit(0);
      });
    });

    process.on("SIGINT", async () => {
      logger.info("SIGINT received, shutting down gracefully");
      server.close(() => {
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();
