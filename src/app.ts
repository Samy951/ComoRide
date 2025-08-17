import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import routes from './routes/index';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { phoneRateLimit } from './middleware/rateLimiter.middleware';
import logger from './config/logger';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}));

// Rate limiting par numéro de téléphone
app.use('/api/v1', phoneRateLimit);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.info('API Request', {
    method: req.method,
    url: req.url,
    phone: req.headers.phone,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// API routes
app.use('/api/v1', routes);

// Serve admin interface static files
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// Admin SPA fallback - serve index.html for all admin routes
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Como Ride API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;