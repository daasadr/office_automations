// Entry point for the unified worker
import { logger } from './shared/logger';

// Log startup information
logger.info('🚀 Starting Temporal Worker Process', {
  nodeVersion: process.version,
  platform: process.platform,
  arch: process.arch,
  pid: process.pid,
  cwd: process.cwd(),
  nodeEnv: process.env.NODE_ENV || 'development',
  startTime: new Date().toISOString()
});

// Import and start the unified worker
import './workers/unified';

