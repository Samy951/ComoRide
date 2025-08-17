import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { 
  AdminRequest, 
  ApiResponse, 
  LoginResponse, 
  AdminUser,
  DriverWithStats,
  PaginatedResponse
} from '../types/api.types';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import {
  loginSchema,
  createDriverSchema,
  updateDriverSchema,
  verifyDriverSchema,
  activateDriverSchema,
  cancelBookingSchema,
  driversQuerySchema,
  bookingsQuerySchema
} from '../schemas/admin.schemas';
import logger from '../config/logger';

const prisma = new PrismaClient();

export class AdminController {
  // Auth endpoints
  static login = [
    validateBody(loginSchema),
    async (req: Request, res: Response<ApiResponse<LoginResponse>>) => {
      try {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (!adminPassword || password !== adminPassword) {
          logger.warn('Admin login attempt with invalid password', {
            ip: req.ip,
            userAgent: req.get('user-agent')
          });
          
          return res.status(401).json({
            success: false,
            error: {
              code: "INVALID_CREDENTIALS",
              message: "Mot de passe incorrect"
            }
          });
        }

        const secretAdmin = process.env.JWT_SECRET_ADMIN || process.env.JWT_SECRET || 'admin-secret-fallback';
        const adminId = 'admin-' + Date.now();
        const loginAt = new Date().toISOString();
        
        const token = jwt.sign(
          { 
            id: adminId,
            role: 'admin'
          },
          secretAdmin,
          { expiresIn: '24h' }
        );

        const admin: AdminUser = {
          id: adminId,
          role: 'admin',
          loginAt
        };

        logger.info('Admin logged in successfully', {
          adminId,
          ip: req.ip
        });

        return res.status(200).json({
          success: true,
          data: {
            token,
            admin
          }
        });
      } catch (error) {
        logger.error('Admin login error', { error });
        return res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de la connexion"
          }
        });
      }
    }
  ];

  static logout = async (req: AdminRequest, res: Response<ApiResponse<void>>) => {
    try {
      logger.info('Admin logged out', {
        adminId: req.admin.id,
        ip: req.ip
      });
      
      return res.status(200).json({
        success: true
      });
    } catch (error) {
      logger.error('Admin logout error', { error });
      return res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Erreur lors de la déconnexion"
        }
      });
    }
  };

  static getCurrentUser = async (req: AdminRequest, res: Response<ApiResponse<AdminUser>>) => {
    try {
      const admin: AdminUser = {
        id: req.admin.id,
        role: req.admin.role,
        loginAt: new Date().toISOString()
      };
      
      return res.status(200).json({
        success: true,
        data: admin
      });
    } catch (error) {
      logger.error('Get current admin error', { error });
      return res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Erreur lors de la récupération des informations"
        }
      });
    }
  };

  // REAL Driver management endpoints
  static getDrivers = [
    validateQuery(driversQuerySchema),
    async (req: AdminRequest, res: Response<ApiResponse<PaginatedResponse<DriverWithStats>>>) => {
      try {
        const query = driversQuerySchema.parse(req.query);
        const { page, limit, search, status, zone, sortBy, sortOrder } = query;
        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};
        
        if (search) {
          where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { phoneNumber: { contains: search } }
          ];
        }
        
        if (status !== 'all') {
          switch (status) {
            case 'verified':
              where.isVerified = true;
              break;
            case 'unverified':
              where.isVerified = false;
              break;
            case 'active':
              where.isActive = true;
              break;
            case 'inactive':
              where.isActive = false;
              break;
          }
        }
        
        if (zone) {
          where.zones = { has: zone };
        }

        // Build order clause
        const orderBy: any = {};
        orderBy[sortBy as string] = sortOrder;

        const [drivers, total] = await Promise.all([
          prisma.driver.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: {
              trips: {
                select: {
                  id: true,
                  customerRating: true
                }
              },
              bookings: {
                select: {
                  id: true,
                  status: true
                }
              }
            }
          }),
          prisma.driver.count({ where })
        ]);

        // Transform to DriverWithStats
        const driversWithStats: DriverWithStats[] = drivers.map(driver => {
          const completedTrips = driver.trips.length;
          const cancelledTrips = driver.bookings.filter((b: any) => b.status === 'CANCELLED').length;
          const totalTrips = driver.bookings.length;
          const averageRating = driver.trips.length > 0 
            ? driver.trips.reduce((sum: number, trip: any) => sum + (trip.customerRating || 0), 0) / driver.trips.length
            : driver.rating;

          // Mask phone number
          const maskedPhone = driver.phoneNumber.replace(/(\+269\d{2})\d{3}(\d{2})/, '$1***$2');

          return {
            id: driver.id,
            phoneNumber: maskedPhone,
            name: driver.name,
            licenseNumber: driver.licenseNumber,
            vehicleType: driver.vehicleType,
            vehiclePlate: driver.vehiclePlate,
            rating: driver.rating,
            isAvailable: driver.isAvailable,
            isOnline: driver.isOnline,
            isVerified: driver.isVerified,
            isActive: driver.isActive,
            zones: driver.zones,
            lastSeenAt: driver.lastSeenAt?.toISOString() || null,
            createdAt: driver.createdAt.toISOString(),
            totalTrips,
            completedTrips,
            cancelledTrips,
            averageRating: Math.round(averageRating * 10) / 10
          };
        });

        const pagination = {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        };

        return res.status(200).json({
          success: true,
          data: {
            data: driversWithStats,
            pagination
          }
        });
      } catch (error) {
        logger.error('Get drivers error', { error, adminId: req.admin.id });
        return res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de la récupération des chauffeurs"
          }
        });
      }
    }
  ];

  static createDriver = [
    validateBody(createDriverSchema),
    async (req: AdminRequest, res: Response<ApiResponse<{ driver: any }>>) => {
      try {
        const { phoneNumber, name, licenseNumber, vehicleType, vehiclePlate, zones, isVerified = false } = req.body;
        
        // Check if phone number or license already exists
        const existingDriver = await prisma.driver.findFirst({
          where: {
            OR: [
              { phoneNumber },
              { licenseNumber }
            ]
          }
        });

        if (existingDriver) {
          const errorCode = existingDriver.phoneNumber === phoneNumber ? "PHONE_EXISTS" : "LICENSE_EXISTS";
          const errorMessage = existingDriver.phoneNumber === phoneNumber 
            ? "Ce numéro de téléphone est déjà utilisé" 
            : "Ce numéro de permis est déjà utilisé";
            
          return res.status(400).json({
            success: false,
            error: {
              code: errorCode,
              message: errorMessage
            }
          });
        }

        const driver = await prisma.driver.create({
          data: {
            phoneNumber,
            name,
            licenseNumber,
            vehicleType,
            vehiclePlate,
            zones,
            isVerified,
            isActive: true
          }
        });

        logger.info('Driver created by admin', {
          driverId: driver.id,
          driverName: driver.name,
          adminId: req.admin.id
        });

        // Mask phone number for response
        const responseDriver = {
          ...driver,
          phoneNumber: driver.phoneNumber.replace(/(\+269\d{2})\d{3}(\d{2})/, '$1***$2')
        };

        return res.status(201).json({
          success: true,
          data: { driver: responseDriver }
        });
      } catch (error) {
        logger.error('Create driver error', { error, adminId: req.admin.id });
        return res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de la création du chauffeur"
          }
        });
      }
    }
  ];

  static updateDriver = [
    validateBody(updateDriverSchema),
    async (req: AdminRequest, res: Response<ApiResponse<{ driver: any }>>) => {
      try {
        const { id } = req.params;
        const updateData = req.body;
        
        const driver = await prisma.driver.findUnique({
          where: { id }
        });

        if (!driver) {
          return res.status(404).json({
            success: false,
            error: {
              code: "DRIVER_NOT_FOUND",
              message: "Chauffeur introuvable"
            }
          });
        }

        // Check license number uniqueness if updating
        if (updateData.licenseNumber && updateData.licenseNumber !== driver.licenseNumber) {
          const existingLicense = await prisma.driver.findFirst({
            where: {
              licenseNumber: updateData.licenseNumber,
              id: { not: id }
            }
          });

          if (existingLicense) {
            return res.status(400).json({
              success: false,
              error: {
                code: "LICENSE_EXISTS",
                message: "Ce numéro de permis est déjà utilisé"
              }
            });
          }
        }

        const updatedDriver = await prisma.driver.update({
          where: { id },
          data: updateData
        });

        logger.info('Driver updated by admin', {
          driverId: id,
          updatedFields: Object.keys(updateData),
          adminId: req.admin.id
        });

        // Mask phone number for response
        const responseDriver = {
          ...updatedDriver,
          phoneNumber: updatedDriver.phoneNumber.replace(/(\+269\d{2})\d{3}(\d{2})/, '$1***$2')
        };

        return res.status(200).json({
          success: true,
          data: { driver: responseDriver }
        });
      } catch (error) {
        logger.error('Update driver error', { error, driverId: req.params.id, adminId: req.admin.id });
        return res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de la modification du chauffeur"
          }
        });
      }
    }
  ];

  static verifyDriver = [
    validateBody(verifyDriverSchema),
    async (req: AdminRequest, res: Response<ApiResponse<{ driver: any; notificationSent: boolean }>>) => {
      try {
        const { id } = req.params;
        const { isVerified, reason } = req.body;
        
        const driver = await prisma.driver.findUnique({
          where: { id }
        });

        if (!driver) {
          return res.status(404).json({
            success: false,
            error: {
              code: "DRIVER_NOT_FOUND",
              message: "Chauffeur introuvable"
            }
          });
        }

        const updatedDriver = await prisma.driver.update({
          where: { id },
          data: { isVerified }
        });

        logger.info('Driver verification status changed by admin', {
          driverId: id,
          isVerified,
          reason,
          adminId: req.admin.id
        });

        // TODO: Send WhatsApp notification to driver
        const notificationSent = false; // Placeholder

        return res.status(200).json({
          success: true,
          data: {
            driver: { id: updatedDriver.id, isVerified: updatedDriver.isVerified },
            notificationSent
          }
        });
      } catch (error) {
        logger.error('Verify driver error', { error, driverId: req.params.id, adminId: req.admin.id });
        return res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de la vérification du chauffeur"
          }
        });
      }
    }
  ];

  static activateDriver = [
    validateBody(activateDriverSchema),
    async (req: AdminRequest, res: Response<ApiResponse<{ driver: any }>>) => {
      try {
        const { id } = req.params;
        const { isActive, reason } = req.body;
        
        const driver = await prisma.driver.findUnique({
          where: { id }
        });

        if (!driver) {
          return res.status(404).json({
            success: false,
            error: {
              code: "DRIVER_NOT_FOUND",
              message: "Chauffeur introuvable"
            }
          });
        }

        const updatedDriver = await prisma.driver.update({
          where: { id },
          data: { isActive }
        });

        logger.info('Driver activation status changed by admin', {
          driverId: id,
          isActive,
          reason,
          adminId: req.admin.id
        });

        return res.status(200).json({
          success: true,
          data: {
            driver: { id: updatedDriver.id, isActive: updatedDriver.isActive }
          }
        });
      } catch (error) {
        logger.error('Activate driver error', { error, driverId: req.params.id, adminId: req.admin.id });
        return res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de l'activation/désactivation du chauffeur"
          }
        });
      }
    }
  ];

  static getBookings = [
    validateQuery(bookingsQuerySchema),
    async (req: AdminRequest, res: Response) => {
      try {
        const query = bookingsQuerySchema.parse(req.query);
        const { page, limit, status, dateFrom, dateTo, sortBy, sortOrder } = query;
        const skip = (page - 1) * limit;

        // Build where clause
        const where: any = {};
        
        if (status !== 'all') {
          where.status = status;
        }
        
        if (dateFrom || dateTo) {
          where.createdAt = {};
          if (dateFrom) where.createdAt.gte = new Date(dateFrom);
          if (dateTo) where.createdAt.lte = new Date(dateTo);
        }

        // Build order clause
        const orderBy: any = {};
        orderBy[sortBy as string] = sortOrder;

        const [bookings, total] = await Promise.all([
          prisma.booking.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  phoneNumber: true,
                  rating: true
                }
              },
              driver: {
                select: {
                  id: true,
                  name: true,
                  phoneNumber: true,
                  vehicleType: true,
                  vehiclePlate: true
                }
              },
              trip: {
                select: {
                  id: true,
                  fare: true,
                  paymentStatus: true,
                  paymentMethod: true
                }
              }
            }
          }),
          prisma.booking.count({ where })
        ]);

        // Transform data - mask phone numbers
        const transformedBookings = bookings.map(booking => ({
          ...booking,
          customer: {
            ...booking.customer,
            phoneNumber: booking.customer.phoneNumber.replace(/(\+269\d{2})\d{3}(\d{2})/, '$1***$2')
          },
          driver: booking.driver ? {
            ...booking.driver,
            phoneNumber: booking.driver.phoneNumber.replace(/(\+269\d{2})\d{3}(\d{2})/, '$1***$2')
          } : null,
          createdAt: booking.createdAt.toISOString(),
          pickupTime: booking.pickupTime.toISOString(),
          updatedAt: booking.updatedAt.toISOString()
        }));

        const pagination = {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        };

        return res.status(200).json({
          success: true,
          data: {
            data: transformedBookings,
            pagination
          }
        });
      } catch (error) {
        logger.error('Get bookings error', { error, adminId: req.admin.id });
        return res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de la récupération des réservations"
          }
        });
      }
    }
  ];

  static getBooking = async (req: AdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      
      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          customer: true,
          driver: true,
          trip: true
        }
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          error: {
            code: "BOOKING_NOT_FOUND",
            message: "Réservation introuvable"
          }
        });
      }

      // Mask phone numbers
      const transformedBooking = {
        ...booking,
        customer: {
          ...booking.customer,
          phoneNumber: booking.customer.phoneNumber.replace(/(\+269\d{2})\d{3}(\d{2})/, '$1***$2')
        },
        driver: booking.driver ? {
          ...booking.driver,
          phoneNumber: booking.driver.phoneNumber.replace(/(\+269\d{2})\d{3}(\d{2})/, '$1***$2')
        } : null,
        createdAt: booking.createdAt.toISOString(),
        pickupTime: booking.pickupTime.toISOString(),
        updatedAt: booking.updatedAt.toISOString()
      };

      return res.status(200).json({
        success: true,
        data: { booking: transformedBooking }
      });
    } catch (error) {
      logger.error('Get booking error', { error, bookingId: req.params.id, adminId: req.admin.id });
      return res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Erreur lors de la récupération de la réservation"
        }
      });
    }
  };

  static cancelBooking = [
    validateBody(cancelBookingSchema),
    async (req: AdminRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { reason, refundCustomer, notifyDriver } = req.body;
        
        const booking = await prisma.booking.findUnique({
          where: { id },
          include: { customer: true, driver: true }
        });

        if (!booking) {
          return res.status(404).json({
            success: false,
            error: {
              code: "BOOKING_NOT_FOUND",
              message: "Réservation introuvable"
            }
          });
        }

        if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
          return res.status(400).json({
            success: false,
            error: {
              code: "BOOKING_CANNOT_BE_CANCELLED",
              message: "Cette réservation ne peut plus être annulée"
            }
          });
        }

        const updatedBooking = await prisma.booking.update({
          where: { id },
          data: { 
            status: 'CANCELLED'
          }
        });

        logger.info('Booking cancelled by admin', {
          bookingId: id,
          reason,
          refundCustomer,
          notifyDriver,
          adminId: req.admin.id
        });

        // TODO: Implement refund logic if refundCustomer is true
        // TODO: Send WhatsApp notifications if notifyDriver is true

        return res.status(200).json({
          success: true,
          data: {
            booking: { id: updatedBooking.id, status: updatedBooking.status },
            refunded: refundCustomer, // Placeholder
            notificationSent: notifyDriver // Placeholder
          }
        });
      } catch (error) {
        logger.error('Cancel booking error', { error, bookingId: req.params.id, adminId: req.admin.id });
        return res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de l'annulation de la réservation"
          }
        });
      }
    }
  ];

  static getStats = async (req: AdminRequest, res: Response) => {
    try {
      // Simple stats for now
      const totalBookingsToday = await prisma.booking.count({
        where: {
          createdAt: {
            gte: new Date(new Date().toDateString()) // Start of today
          }
        }
      });

      const activeDrivers = await prisma.driver.count({
        where: {
          isActive: true,
          isVerified: true
        }
      });

      const pendingBookings = await prisma.booking.count({
        where: {
          status: 'PENDING'
        }
      });

      return res.status(200).json({
        success: true,
        data: {
          overview: {
            totalBookingsToday,
            completedTripsToday: 0,
            activeDrivers,
            onlineDrivers: 0,
            pendingBookings,
            revenue: {
              today: 0,
              week: 0,
              month: 0
            }
          },
          charts: {
            bookingsPerHour: [],
            topZones: [],
            driverPerformance: []
          }
        }
      });
    } catch (error) {
      logger.error('Get stats error', { error, adminId: req.admin.id });
      return res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Erreur lors de la récupération des statistiques"
        }
      });
    }
  };
}