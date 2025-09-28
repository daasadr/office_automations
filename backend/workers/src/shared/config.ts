import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Temporal configuration
  temporal: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TASK_QUEUE || 'default'
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
    apiToken: process.env.DIRECTUS_API_TOKEN || ''
  },
  
  // S3/MinIO configuration
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'documents',
    region: process.env.S3_REGION || 'us-east-1'
  },
  
  // LLM configuration
  llm: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    }
  },
  
  // OCR configuration
  ocr: {
    tesseractLang: process.env.TESSERACT_LANG || 'ces+eng'
  },
  
  // Notification configuration
  notifications: {
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || ''
    },
    email: {
      smtpHost: process.env.EMAIL_SMTP_HOST || '',
      smtpPort: parseInt(process.env.EMAIL_SMTP_PORT || '587', 10),
      smtpUser: process.env.EMAIL_SMTP_USER || '',
      smtpPassword: process.env.EMAIL_SMTP_PASSWORD || '',
      from: process.env.EMAIL_FROM || ''
    }
  }
};


