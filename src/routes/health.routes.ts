import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../config/logger';
import { whatsappBot } from '../bot/index';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Get WhatsApp bot status
    const whatsappStatus = process.env.NODE_ENV === 'test' ? 
      'disabled_in_test' : 
      (whatsappBot.isConnected() ? 'connected' : 'disconnected');
    
    // Get bot health details
    const botHealth = process.env.NODE_ENV === 'test' ? 
      null : 
      whatsappBot.getHealthStatus();
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'connected',
        whatsapp: whatsappStatus,
        api: 'running'
      },
      bot: botHealth
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    
    const whatsappStatus = process.env.NODE_ENV === 'test' ? 
      'disabled_in_test' : 
      'error';
    
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
        whatsapp: whatsappStatus,
        api: 'error'
      },
    });
  }
});

export default router;