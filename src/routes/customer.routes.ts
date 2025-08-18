import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';
import { PhoneUtils } from '../bot/utils/phone.utils';

const router = Router();
const prisma = new PrismaClient();

/**
 * Create or update a customer
 * POST /customers
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, name } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Phone number is required'
      });
    }

    // Normalize phone number
    const normalizedPhone = PhoneUtils.normalizePhoneNumber(phoneNumber);

    const customer = await prisma.customer.upsert({
      where: { phoneNumber: normalizedPhone },
      update: { 
        name: name || undefined,
        updatedAt: new Date()
      },
      create: {
        phoneNumber: normalizedPhone,
        name: name || 'Client Como Ride',
        rating: 5.0
      }
    });

    logger.info('Customer created/updated via API', {
      phoneNumber: PhoneUtils.maskPhoneNumber(normalizedPhone),
      name: customer.name
    });

    res.status(201).json({
      id: customer.id,
      phoneNumber: customer.phoneNumber,
      name: customer.name,
      rating: customer.rating,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    });

  } catch (error) {
    logger.error('Customer creation API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get customer by phone number
 * GET /customers?phone=+269123456789
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { phone } = req.query;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({
        error: 'Phone number query parameter is required'
      });
    }

    const normalizedPhone = PhoneUtils.normalizePhoneNumber(phone);

    const customer = await prisma.customer.findUnique({
      where: { phoneNumber: normalizedPhone },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            driver: {
              select: { name: true, phoneNumber: true }
            }
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }

    res.status(200).json(customer);

  } catch (error) {
    logger.error('Customer get API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get customer by ID
 * GET /customers/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            driver: {
              select: { name: true, phoneNumber: true }
            }
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }

    res.status(200).json(customer);

  } catch (error) {
    logger.error('Customer get by ID API error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;