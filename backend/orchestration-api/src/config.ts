import dotenv from "dotenv";

dotenv.config();

// Environment variable validation
interface EnvironmentConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
  cors: {
    origin: string[];
  };
  directus: {
    url: string;
    token: string;
  };
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  keydb: {
    host: string;
    port: number;
    password: string;
  };
  minio: {
    endpoint: string;
    port: number;
    accessKey: string;
    secretKey: string;
    useSSL: boolean;
  };
  gemini: {
    apiKey?: string;
    model: string;
  };
  jobCleanup: {
    maxAgeHours: number;
    intervalHours: number;
    enabled: boolean;
  };
  sentry: {
    dsn?: string;
    enabled: boolean;
    tracesSampleRate: number;
    profilesSampleRate: number;
    sendDefaultPii: boolean;
  };
}

/**
 * Parses CORS origin configuration
 */
function parseCorsOrigin(corsOrigin: string): string[] {
  return corsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Validates and creates configuration object
 */
function createConfig(): EnvironmentConfig {
  const port = parseInt(process.env.PORT || "3001", 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535.`);
  }

  const nodeEnv = process.env.NODE_ENV || "development";
  const validNodeEnvs = ["development", "production", "test"];
  if (!validNodeEnvs.includes(nodeEnv)) {
    console.warn(
      `Warning: NODE_ENV "${nodeEnv}" is not standard. Expected: ${validNodeEnvs.join(", ")}`
    );
  }

  const logLevel = process.env.LOG_LEVEL || "info";
  const validLogLevels = ["error", "warn", "info", "http", "verbose", "debug", "silly"];
  if (!validLogLevels.includes(logLevel)) {
    console.warn(
      `Warning: LOG_LEVEL "${logLevel}" is not valid. Expected: ${validLogLevels.join(", ")}`
    );
  }

  const corsOrigin = parseCorsOrigin(
    process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:4321"
  );

  const directusUrl = process.env.DIRECTUS_URL || "http://localhost:8055";
  const directusToken = process.env.DIRECTUS_TOKEN || process.env.DIRECTUS_API_TOKEN || "";

  return {
    port,
    nodeEnv,
    logLevel,
    cors: {
      origin: corsOrigin,
    },
    directus: {
      url: directusUrl,
      token: directusToken,
    },
    postgres: {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_DATABASE || "directus",
      user: process.env.DB_USER || "directus",
      password: process.env.DB_PASSWORD || "",
    },
    keydb: {
      host: process.env.REDIS_HOST || process.env.KEYDB_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || process.env.KEYDB_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || process.env.KEYDB_PASSWORD || "",
    },
    minio: {
      endpoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_API_PORT || "9000", 10),
      accessKey: process.env.MINIO_ACCESS_KEY || "",
      secretKey: process.env.MINIO_SECRET_KEY || "",
      useSSL: process.env.MINIO_USE_SSL === "true",
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    },
    jobCleanup: {
      maxAgeHours: parseInt(process.env.JOB_CLEANUP_MAX_AGE_HOURS || "24", 10),
      intervalHours: parseInt(process.env.JOB_CLEANUP_INTERVAL_HOURS || "1", 10),
      enabled: process.env.JOB_CLEANUP_ENABLED !== "false",
    },
    sentry: {
      dsn: process.env.SENTRY_DSN,
      enabled: process.env.SENTRY_ENABLED !== "false",
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0.1"),
      sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII === "true",
    },
  };
}

export const config = createConfig();

// Validate required environment variables
const requiredEnvVars = ["GEMINI_API_KEY"];
const optionalEnvVars = ["DIRECTUS_URL", "DIRECTUS_TOKEN"];
const missingEnvVars: string[] = [];
const missingOptionalEnvVars: string[] = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingEnvVars.push(envVar);
  }
}

for (const envVar of optionalEnvVars) {
  if (!process.env[envVar]) {
    missingOptionalEnvVars.push(envVar);
  }
}

if (missingEnvVars.length > 0) {
  console.warn(`Warning: Missing required environment variables: ${missingEnvVars.join(", ")}`);
  console.warn("The application may not function correctly without these variables.");
}

if (missingOptionalEnvVars.length > 0) {
  console.warn(
    `Warning: Missing optional environment variables: ${missingOptionalEnvVars.join(", ")}`
  );
  console.warn("Some features may be limited without these variables.");
}

// Log configuration in development
if (config.nodeEnv === "development") {
  console.log("Configuration loaded:", {
    port: config.port,
    nodeEnv: config.nodeEnv,
    logLevel: config.logLevel,
    corsOrigin: config.cors.origin,
    directusUrl: config.directus.url,
    directusConfigured: Boolean(config.directus.token),
    postgresConfigured: Boolean(config.postgres.password),
    keydbConfigured: Boolean(config.keydb.password),
    minioConfigured: Boolean(config.minio.accessKey && config.minio.secretKey),
    geminiConfigured: Boolean(config.gemini.apiKey),
    geminiModel: config.gemini.model,
    jobCleanup: config.jobCleanup,
    sentryConfigured: Boolean(config.sentry.dsn),
    sentryEnabled: config.sentry.enabled,
  });
}
