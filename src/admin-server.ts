import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import adminRoutes from './routes/admin.routes';
import healthRoutes from './routes/health.routes';
import logger from './config/logger';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.info('API Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check
app.use('/api/v1', healthRoutes);

// Admin API routes
app.use('/api/v1/admin', adminRoutes);

// Serve admin interface static files
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// Admin SPA fallback - serve index.html for all admin routes
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Como Ride Admin API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    app.listen(PORT, () => {
      logger.info(`🚀 Admin server running on port ${PORT}`);
      logger.info(`📱 Admin interface: http://localhost:${PORT}/admin`);
      logger.info(`🔗 API: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();