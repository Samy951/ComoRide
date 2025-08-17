import 'dotenv/config';
import app from './app';
import logger from './config/logger';
import prisma from './config/database';
import { whatsappBot } from './bot/index';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Initialize WhatsApp bot
    if (process.env.NODE_ENV !== 'test') {
      await whatsappBot.initialize();
      logger.info('WhatsApp bot initialized successfully');
    }

    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      if (process.env.NODE_ENV !== 'test') {
        logger.info(`WhatsApp bot status: ${whatsappBot.isConnected() ? 'Connected' : 'Connecting...'}`);
      }
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Starting graceful shutdown...');
      
      // Shutdown WhatsApp bot first
      if (process.env.NODE_ENV !== 'test') {
        await whatsappBot.disconnect();
        logger.info('WhatsApp bot disconnected');
      }
      
      server.close(() => {
        logger.info('HTTP server closed');
      });

      await prisma.$disconnect();
      logger.info('Database connection closed');
      
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown();
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();