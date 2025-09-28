import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Temporal configuration
  temporal: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'document-processing'
  },
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_DATABASE || 'directus',
    user: process.env.DB_USER || 'directus',
    password: process.env.DB_PASSWORD || 'directus'
  },
  
  // Directus configuration
  directus: {
    url: process.env.DIRECTUS_URL || 'http://localhost:8055',
    token: process.env.DIRECTUS_TOKEN || '',
    apiToken: process.env.DIRECTUS_API_TOKEN || ''
  },
  
  // Security configuration
  security: {
    apiSecretKey: process.env.API_SECRET_KEY || 'your-secret-key',
    webhookSecret: process.env.WEBHOOK_SECRET || 'webhook-secret'
  },
  
  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:4321,http://localhost:8055'
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'TEMPORAL_ADDRESS',
  'DB_HOST',
  'DB_PASSWORD',
  'DIRECTUS_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}


