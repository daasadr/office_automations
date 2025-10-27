import winston from "winston";
import { config } from "@orchestration-api/config";

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create base transports array
const transports: winston.transport[] = [];

// Add console transport with appropriate format based on environment
if (config.nodeEnv === "production") {
  // Production: JSON format for structured logging
  transports.push(
    new winston.transports.Console({
      format,
    })
  );
} else {
  // Development: Colorized simple format for readability
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}

export const logger = winston.createLogger({
  level: config.logLevel,
  format,
  defaultMeta: { service: "orchestration-api" },
  transports,
});
