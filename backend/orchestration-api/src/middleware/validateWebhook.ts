import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

export function validateWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    
    if (!signature || !timestamp) {
      logger.warn('Missing webhook signature or timestamp', {
        signature: !!signature,
        timestamp: !!timestamp,
        headers: req.headers
      });
      return res.status(401).json({ error: 'Missing webhook signature or timestamp' });
    }

    // Check timestamp to prevent replay attacks (within 5 minutes)
    const requestTime = parseInt(timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - requestTime);
    
    if (timeDiff > 300) { // 5 minutes
      logger.warn('Webhook timestamp too old', { timeDiff, requestTime, currentTime });
      return res.status(401).json({ error: 'Request timestamp too old' });
    }

    // Verify signature
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', config.security.webhookSecret)
      .update(timestamp + payload)
      .digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      logger.warn('Invalid webhook signature', { 
        provided: signature, 
        expected: expectedSignature 
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  } catch (error) {
    logger.error('Error validating webhook signature', error);
    res.status(500).json({ error: 'Failed to validate webhook' });
  }
}


