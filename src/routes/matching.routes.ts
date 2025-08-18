import { Router, Request, Response } from 'express';
import { MatchingService } from '../services/matching.service';
import logger from '../config/logger';

const router = Router();
const matchingService = MatchingService.getInstance();

/**
 * Start matching process for a booking
 * POST /matching/start
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { bookingId, options = {} } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID is required'
      });
    }

    const result = await matchingService.startMatching(bookingId, options);

    logger.info('Matching start API called', {
      bookingId,
      success: result.success,
      driversNotified: result.driversNotified,
      errors: result.errors.length
    });

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Matching start API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Handle driver response to booking notification
 * POST /matching/response
 */
router.post('/response', async (req: Request, res: Response) => {
  try {
    const { bookingId, driverId, response } = req.body;

    if (!bookingId || !driverId || !response) {
      return res.status(400).json({
        success: false,
        error: 'bookingId, driverId, and response are required'
      });
    }

    if (!response.type || !['ACCEPT', 'REJECT'].includes(response.type)) {
      return res.status(400).json({
        success: false,
        error: 'response.type must be ACCEPT or REJECT'
      });
    }

    const result = await matchingService.handleDriverResponse(
      bookingId,
      driverId,
      {
        type: response.type,
        timestamp: response.timestamp ? new Date(response.timestamp) : new Date(),
        responseTime: response.responseTime || 0
      }
    );

    logger.info('Driver response API called', {
      bookingId,
      driverId,
      responseType: response.type,
      success: result.success,
      action: result.action
    });

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Driver response API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel matching process for a booking
 * POST /matching/cancel
 */
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const { bookingId, reason } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID is required'
      });
    }

    await matchingService.cancelMatching(bookingId, reason || 'Manual cancellation');

    logger.info('Matching cancel API called', {
      bookingId,
      reason
    });

    res.status(200).json({
      success: true,
      message: 'Matching cancelled successfully'
    });

  } catch (error) {
    logger.error('Matching cancel API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get matching status for a booking
 * GET /matching/status/:bookingId
 */
router.get('/status/:bookingId', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    // This would typically return matching progress, but for now just return booking status
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        driver: {
          select: { name: true, phoneNumber: true }
        },
        metrics: true
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    res.status(200).json({
      success: true,
      booking,
      status: booking.status,
      metrics: booking.metrics
    });

  } catch (error) {
    logger.error('Matching status API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;