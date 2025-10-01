import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:4321",
  },
};

// Validate required environment variables
const requiredEnvVars = ["GEMINI_API_KEY"];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`Warning: ${envVar} environment variable is not set`);
  }
}
