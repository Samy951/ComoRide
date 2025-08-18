import { Router, Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../config/logger';
import { whatsappBot } from '../bot/index';
import { MetricsServiceImpl } from '../services/metrics.service';
import { timeoutManager } from '../services/timeout.manager';

const router = Router();
const metricsService = MetricsServiceImpl.getInstance();

/**
 * Basic health check endpoint
 * GET /health
 */
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

/**
 * Detailed health check with TICKET-007 metrics
 * GET /health/detailed
 */
router.get('/health/detailed', async (_req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Test database connectivity
    const dbHealth = await checkDatabaseHealth();
    
    // Test WhatsApp service availability
    const whatsappHealth = await checkWhatsAppHealth();
    
    // Get timeout manager stats
    const timeoutStats = timeoutManager.getActiveTimeouts();
    
    // Get system metrics from TICKET-007
    const systemMetrics = await metricsService.getSystemHealthMetrics();
    
    const responseTime = Date.now() - startTime;
    
    const overallStatus = determineOverallStatus([
      dbHealth.status,
      whatsappHealth.status,
      systemMetrics.overall
    ]);

    const detailedHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      components: {
        database: dbHealth,
        whatsapp: whatsappHealth,
        timeouts: {
          status: timeoutStats.drivers + timeoutStats.bookings < 100 ? 'HEALTHY' : 'WARNING',
          activeDriverTimeouts: timeoutStats.drivers,
          activeBookingTimeouts: timeoutStats.bookings,
          details: 'Timeout manager operational'
        },
        matching: {
          status: systemMetrics.components?.matching || 'UNKNOWN',
          activeMatchings: systemMetrics.activeMatchings,
          recentBookings: systemMetrics.recentBookings,
          details: 'Matching service operational'
        }
      },
      metrics: systemMetrics,
      memory: {
        usage: process.memoryUsage(),
        heap: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      }
    };

    const statusCode = overallStatus === 'HEALTHY' ? 200 : 
                      overallStatus === 'WARNING' ? 200 : 503;

    res.status(statusCode).json(detailedHealth);

  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(503).json({
      status: 'CRITICAL',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Readiness probe for Kubernetes/Docker
 * GET /health/ready
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    // Check if app is ready to serve traffic
    const dbConnected = await checkDatabaseConnection();
    const criticalServicesUp = await checkCriticalServices();

    if (dbConnected && criticalServicesUp) {
      res.status(200).json({
        status: 'READY',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'NOT_READY',
        timestamp: new Date().toISOString(),
        details: {
          database: dbConnected,
          criticalServices: criticalServicesUp
        }
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'NOT_READY',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Liveness probe for Kubernetes/Docker
 * GET /health/live
 */
router.get('/health/live', async (_req: Request, res: Response) => {
  try {
    // Simple check that the process is alive
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    
    // Consider unhealthy if using more than 1GB of heap
    if (heapUsedMB > 1024) {
      res.status(503).json({
        status: 'UNHEALTHY',
        reason: 'High memory usage',
        heapUsedMB: Math.round(heapUsedMB),
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.status(200).json({
      status: 'ALIVE',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      heapUsedMB: Math.round(heapUsedMB)
    });
  } catch (error) {
    res.status(503).json({
      status: 'DEAD',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Metrics endpoint for Prometheus/monitoring
 * GET /health/metrics
 */
router.get('/health/metrics', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const timeframe = { start: oneHourAgo, end: now };

    const [
      activeMatchings,
      avgMatchingTime,
      acceptanceRate,
      timeoutRate,
      systemHealth
    ] = await Promise.all([
      metricsService.getActiveMatchings(),
      metricsService.getAverageMatchingTime(timeframe),
      metricsService.getAcceptanceRate(timeframe),
      metricsService.getTimeoutRate(timeframe),
      metricsService.getSystemHealthMetrics()
    ]);

    const timeoutStats = timeoutManager.getActiveTimeouts();
    const memoryUsage = process.memoryUsage();

    // Prometheus-style metrics
    const prometheusMetrics = `
# HELP como_ride_active_matchings Number of active matching processes
# TYPE como_ride_active_matchings gauge
como_ride_active_matchings ${activeMatchings}

# HELP como_ride_average_matching_time_seconds Average time to match a booking in seconds
# TYPE como_ride_average_matching_time_seconds gauge
como_ride_average_matching_time_seconds ${avgMatchingTime}

# HELP como_ride_acceptance_rate_percent Driver acceptance rate percentage
# TYPE como_ride_acceptance_rate_percent gauge
como_ride_acceptance_rate_percent ${acceptanceRate}

# HELP como_ride_timeout_rate_percent Booking timeout rate percentage
# TYPE como_ride_timeout_rate_percent gauge
como_ride_timeout_rate_percent ${timeoutRate}

# HELP como_ride_active_driver_timeouts Number of active driver timeouts
# TYPE como_ride_active_driver_timeouts gauge
como_ride_active_driver_timeouts ${timeoutStats.drivers}

# HELP como_ride_active_booking_timeouts Number of active booking timeouts
# TYPE como_ride_active_booking_timeouts gauge
como_ride_active_booking_timeouts ${timeoutStats.bookings}

# HELP como_ride_active_drivers Number of currently active drivers
# TYPE como_ride_active_drivers gauge
como_ride_active_drivers ${systemHealth.activeDrivers}

# HELP como_ride_recent_bookings Number of bookings in the last hour
# TYPE como_ride_recent_bookings gauge
como_ride_recent_bookings ${systemHealth.recentBookings}

# HELP como_ride_memory_heap_used_bytes Memory heap usage in bytes
# TYPE como_ride_memory_heap_used_bytes gauge
como_ride_memory_heap_used_bytes ${memoryUsage.heapUsed}

# HELP como_ride_memory_heap_total_bytes Total memory heap in bytes
# TYPE como_ride_memory_heap_total_bytes gauge
como_ride_memory_heap_total_bytes ${memoryUsage.heapTotal}

# HELP como_ride_uptime_seconds Process uptime in seconds
# TYPE como_ride_uptime_seconds counter
como_ride_uptime_seconds ${process.uptime()}

# HELP como_ride_health_status Overall system health status (1=HEALTHY, 0.5=WARNING, 0=CRITICAL)
# TYPE como_ride_health_status gauge
como_ride_health_status ${systemHealth.overall === 'HEALTHY' ? 1 : systemHealth.overall === 'WARNING' ? 0.5 : 0}
`.trim();

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(prometheusMetrics);

  } catch (error) {
    logger.error('Metrics endpoint failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(503).json({
      error: 'Failed to generate metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper functions
async function checkDatabaseHealth(): Promise<any> {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;

    return {
      status: 'HEALTHY',
      responseTime: `${responseTime}ms`,
      details: 'Database connection successful'
    };
  } catch (error) {
    return {
      status: 'CRITICAL',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Database connection failed'
    };
  }
}

async function checkWhatsAppHealth(): Promise<any> {
  try {
    if (process.env.NODE_ENV === 'test') {
      return {
        status: 'HEALTHY',
        details: 'WhatsApp service disabled in test'
      };
    }

    if (whatsappBot && whatsappBot.isConnected()) {
      return {
        status: 'HEALTHY',
        details: 'WhatsApp service connected'
      };
    } else {
      return {
        status: 'WARNING',
        details: 'WhatsApp service not connected'
      };
    }
  } catch (error) {
    return {
      status: 'CRITICAL',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'WhatsApp service check failed'
    };
  }
}

async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkCriticalServices(): Promise<boolean> {
  try {
    // Check if critical services are operational
    const activeMatchings = await metricsService.getActiveMatchings();
    return activeMatchings >= 0; // Simple check that service responds
  } catch {
    return false;
  }
}

function determineOverallStatus(statuses: string[]): 'HEALTHY' | 'WARNING' | 'CRITICAL' {
  if (statuses.includes('CRITICAL')) return 'CRITICAL';
  if (statuses.includes('WARNING')) return 'WARNING';
  return 'HEALTHY';
}

export default router;