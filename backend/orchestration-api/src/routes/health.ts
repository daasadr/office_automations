import { Router } from "express";
import { Pool } from "pg";
import Redis from "ioredis";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { config } from "@orchestration-api/config";
import { directusClient } from "@orchestration-api/lib/directus";
import { readItems } from "@directus/sdk";

const router = Router();

// Service status type
type ServiceStatus = "healthy" | "unhealthy" | "not_configured";

interface ServiceCheck {
  status: ServiceStatus;
  message?: string;
  latency?: number;
}

interface HealthResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  environment: string;
  services: {
    api: ServiceCheck;
    directus: ServiceCheck;
    postgres: ServiceCheck;
    keydb: ServiceCheck;
    minio: ServiceCheck;
    gemini: ServiceCheck;
  };
}

/**
 * Check Directus connectivity
 */
async function checkDirectus(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    if (!directusClient || !config.directus.token) {
      return { status: "not_configured", message: "Directus not configured" };
    }

    // Try to ping Directus by reading from source_documents collection
    await directusClient.request(readItems("source_documents", { limit: 1 }));

    return {
      status: "healthy",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Connection failed",
      latency: Date.now() - start,
    };
  }
}

/**
 * Check PostgreSQL connectivity
 */
async function checkPostgres(): Promise<ServiceCheck> {
  const start = Date.now();
  let pool: Pool | null = null;

  try {
    if (!config.postgres.password) {
      return { status: "not_configured", message: "PostgreSQL not configured" };
    }

    pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      connectionTimeoutMillis: 5000,
    });

    await pool.query("SELECT 1");

    return {
      status: "healthy",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Connection failed",
      latency: Date.now() - start,
    };
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

/**
 * Check KeyDB/Redis connectivity
 */
async function checkKeyDB(): Promise<ServiceCheck> {
  const start = Date.now();
  let redis: Redis | null = null;

  try {
    if (!config.keydb.password) {
      return { status: "not_configured", message: "KeyDB not configured" };
    }

    redis = new Redis({
      host: config.keydb.host,
      port: config.keydb.port,
      password: config.keydb.password,
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    await redis.connect();
    await redis.ping();

    return {
      status: "healthy",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Connection failed",
      latency: Date.now() - start,
    };
  } finally {
    if (redis) {
      redis.disconnect();
    }
  }
}

/**
 * Check MinIO/S3 connectivity
 */
async function checkMinIO(): Promise<ServiceCheck> {
  const start = Date.now();

  try {
    if (!config.minio.accessKey || !config.minio.secretKey) {
      return { status: "not_configured", message: "MinIO not configured" };
    }

    const s3Client = new S3Client({
      endpoint: `${config.minio.useSSL ? "https" : "http"}://${config.minio.endpoint}:${config.minio.port}`,
      region: "us-east-1",
      credentials: {
        accessKeyId: config.minio.accessKey,
        secretAccessKey: config.minio.secretKey,
      },
      forcePathStyle: true,
    });

    // Try to access a bucket or list buckets
    // We'll just try to head a common bucket, if it fails it's still checking connectivity
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: process.env.MINIO_BUCKET || "default" }));
    } catch (bucketError) {
      // Bucket might not exist, but if we get here, MinIO is accessible
      // Check if it's a 404 (bucket not found) vs connection error
      const errorWithMetadata = bucketError as { $metadata?: { httpStatusCode?: number } };
      const errorCode = errorWithMetadata.$metadata?.httpStatusCode;
      if (errorCode === 404 || errorCode === 403) {
        // MinIO is accessible, bucket just doesn't exist or no permission
        return {
          status: "healthy",
          latency: Date.now() - start,
          message: "Connected (bucket not found or no permission)",
        };
      }
      throw bucketError;
    }

    return {
      status: "healthy",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Connection failed",
      latency: Date.now() - start,
    };
  }
}

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check endpoint
 *     description: Returns the health status of the API and its dependencies
 *     operationId: getHealth
 *     responses:
 *       200:
 *         description: Service is healthy or partially healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       503:
 *         description: Service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
router.get("/", async (_req, res) => {
  try {
    // Run all health checks in parallel
    const [directusCheck, postgresCheck, keydbCheck, minioCheck] = await Promise.all([
      checkDirectus(),
      checkPostgres(),
      checkKeyDB(),
      checkMinIO(),
    ]);

    // Check Gemini configuration (no actual API call to avoid quota usage)
    const geminiCheck: ServiceCheck = config.gemini.apiKey
      ? { status: "healthy", message: "configured" }
      : { status: "not_configured", message: "API key not set" };

    // Determine overall health
    const allServices = [directusCheck, postgresCheck, keydbCheck, minioCheck, geminiCheck];
    const hasUnhealthy = allServices.some((check) => check.status === "unhealthy");
    const overallStatus = hasUnhealthy ? "unhealthy" : "healthy";

    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      services: {
        api: { status: "healthy", message: "running" },
        directus: directusCheck,
        postgres: postgresCheck,
        keydb: keydbCheck,
        minio: minioCheck,
        gemini: geminiCheck,
      },
    };

    const statusCode = overallStatus === "healthy" ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      error: error instanceof Error ? error.message : "Unknown error",
      services: {
        api: { status: "healthy", message: "running" },
        directus: { status: "unhealthy", message: "Check failed" },
        postgres: { status: "unhealthy", message: "Check failed" },
        keydb: { status: "unhealthy", message: "Check failed" },
        minio: { status: "unhealthy", message: "Check failed" },
        gemini: { status: "unhealthy", message: "Check failed" },
      },
    });
  }
});

export { router as healthRouter };
