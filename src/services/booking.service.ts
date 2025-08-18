import { PrismaClient, BookingStatus } from '@prisma/client';
import { CreateBookingRequest, AcceptBookingRequest, CancelBookingRequest } from '../schemas/booking.schemas';
import { 
  BookingResponse, 
  BookingDetailsResponse, 
  AcceptBookingResponse, 
  CancelBookingResponse 
} from '../types/api.types';
// Removed DriverNotificationService direct import - now using MatchingService
import logger from '../config/logger';

const prisma = new PrismaClient();

export class BookingService {
  static async createBooking(
    customerId: string,
    data: CreateBookingRequest
  ): Promise<BookingResponse> {
    // Calculate estimated fare based on distance/zones
    const estimatedFare = await this.calculateEstimatedFare(data);
    
    const booking = await prisma.booking.create({
      data: {
        customerId,
        pickupAddress: data.pickupAddress,
        dropAddress: data.dropAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropLat: data.dropLat,
        dropLng: data.dropLng,
        pickupTime: new Date(data.pickupTime),
        passengers: data.passengers,
        notes: data.notes,
        estimatedFare,
        status: BookingStatus.PENDING
      },
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropAddress: true,
        pickupTime: true,
        passengers: true,
        estimatedFare: true,
        createdAt: true
      }
    });

    // NOUVEAU: Utiliser MatchingService au lieu de DriverNotificationService directement
    try {
      const { MatchingService } = await import('./matching.service');
      const matchingService = MatchingService.getInstance();
      
      const matchingResult = await matchingService.startMatching(booking.id, {
        maxDistance: undefined, // Pas de limite - broadcaster à TOUS
        priorityMode: 'RECENT_ACTIVITY' // Selon spec
      });
      
      logger.info('Matching process initiated', {
        bookingId: booking.id,
        success: matchingResult.success,
        driversNotified: matchingResult.driversNotified,
        errors: matchingResult.errors.length,
        matchingMetricsId: matchingResult.matchingMetricsId
      });
    } catch (error) {
      logger.error('Failed to start matching for new booking', {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't fail booking creation if matching fails
    }

    return {
      id: booking.id,
      status: booking.status as "PENDING",
      pickupAddress: booking.pickupAddress,
      dropAddress: booking.dropAddress,
      pickupTime: booking.pickupTime.toISOString(),
      passengers: booking.passengers,
      estimatedFare: booking.estimatedFare || undefined,
      createdAt: booking.createdAt.toISOString()
    };
  }

  static async getBookingDetails(bookingId: string): Promise<BookingDetailsResponse | null> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          select: {
            name: true,
            phoneNumber: true
          }
        },
        driver: {
          select: {
            name: true,
            phoneNumber: true,
            vehicleType: true,
            vehiclePlate: true,
            rating: true
          }
        }
      }
    });

    if (!booking) return null;

    return {
      id: booking.id,
      status: booking.status as "PENDING" | "ACCEPTED" | "CANCELLED" | "COMPLETED",
      pickupAddress: booking.pickupAddress,
      dropAddress: booking.dropAddress,
      pickupTime: booking.pickupTime.toISOString(),
      passengers: booking.passengers,
      customer: {
        name: booking.customer.name,
        phoneNumber: this.maskPhoneNumber(booking.customer.phoneNumber)
      },
      driver: booking.driver ? {
        name: booking.driver.name,
        phoneNumber: booking.driver.phoneNumber,
        vehicleType: booking.driver.vehicleType,
        vehiclePlate: booking.driver.vehiclePlate,
        rating: booking.driver.rating
      } : undefined,
      estimatedFare: booking.estimatedFare || undefined,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString()
    };
  }

  static async acceptBooking(
    bookingId: string,
    driverId: string,
    data: AcceptBookingRequest
  ): Promise<AcceptBookingResponse | null> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true }
    });

    if (!booking || booking.status !== BookingStatus.PENDING) {
      return null;
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        driverId,
        status: BookingStatus.ACCEPTED,
        estimatedFare: data.estimatedFare
      },
      include: {
        driver: {
          select: {
            name: true,
            phoneNumber: true,
            vehicleType: true,
            vehiclePlate: true
          }
        }
      }
    });

    // Note: Driver notification service acceptance confirmation now handled by MatchingService

    return {
      id: updatedBooking.id,
      status: "ACCEPTED",
      driver: {
        name: updatedBooking.driver!.name,
        phoneNumber: updatedBooking.driver!.phoneNumber,
        vehicleType: updatedBooking.driver!.vehicleType,
        vehiclePlate: updatedBooking.driver!.vehiclePlate
      },
      estimatedFare: updatedBooking.estimatedFare || undefined,
      updatedAt: updatedBooking.updatedAt.toISOString()
    };
  }

  static async cancelBooking(
    bookingId: string,
    data: CancelBookingRequest
  ): Promise<CancelBookingResponse | null> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true }
    });

    if (!booking || booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.CANCELLED) {
      return null;
    }

    // NOUVEAU: Annuler le matching actif si booking est PENDING
    if (booking.status === BookingStatus.PENDING) {
      try {
        const { MatchingService } = await import('./matching.service');
        const matchingService = MatchingService.getInstance();
        
        await matchingService.cancelMatching(bookingId, data.reason);
        
        logger.info('Matching cancelled for booking cancellation', {
          bookingId,
          reason: data.reason
        });
      } catch (error) {
        logger.error('Failed to cancel matching for booking cancellation', {
          bookingId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Continue with booking cancellation even if matching cancellation fails
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: data.reason
      },
      select: {
        id: true,
        status: true,
        cancellationReason: true,
        updatedAt: true
      }
    });

    logger.info('Booking cancelled successfully', {
      bookingId,
      reason: data.reason,
      previousStatus: booking.status
    });

    return {
      id: updatedBooking.id,
      status: "CANCELLED",
      cancellationReason: updatedBooking.cancellationReason!,
      updatedAt: updatedBooking.updatedAt.toISOString()
    };
  }

  private static async calculateEstimatedFare(data: CreateBookingRequest): Promise<number> {
    // Simplified fare calculation - in production this would be more sophisticated
    let baseFare = 1500; // Base fare in KMF
    
    // Determine if inter-zone or intra-zone
    const pickupZone = this.determineZone(data.pickupLat, data.pickupLng);
    const dropZone = this.determineZone(data.dropLat, data.dropLng);
    
    if (pickupZone !== dropZone) {
      baseFare = 2500; // Inter-zone fare
    }
    
    // Airport supplement
    if (this.isAirportLocation(data.pickupAddress) || this.isAirportLocation(data.dropAddress)) {
      baseFare += 1000;
    }
    
    // Time-based supplements
    const pickupTime = new Date(data.pickupTime);
    const hour = pickupTime.getHours();
    
    if (hour >= 22 || hour < 6) {
      baseFare += 500; // Night supplement
    }
    
    // Passenger supplement
    if (data.passengers > 2) {
      baseFare += (data.passengers - 2) * 200;
    }
    
    return Math.round(baseFare);
  }

  private static determineZone(lat?: number, lng?: number): string {
    if (!lat || !lng) return 'unknown';
    
    // Simplified zone determination for Comoros
    // Grande Comore
    if (lat >= -11.9 && lat <= -11.3 && lng >= 43.2 && lng <= 43.5) {
      return 'grande_comore';
    }
    
    // Anjouan
    if (lat >= -12.4 && lat <= -12.0 && lng >= 44.3 && lng <= 44.6) {
      return 'anjouan';
    }
    
    // Mohéli
    if (lat >= -12.4 && lat <= -12.2 && lng >= 43.7 && lng <= 44.0) {
      return 'moheli';
    }
    
    return 'unknown';
  }

  private static isAirportLocation(address: string): boolean {
    const airportKeywords = ['aéroport', 'airport', 'hahaya', 'ouani', 'prince said ibrahim'];
    return airportKeywords.some(keyword => 
      address.toLowerCase().includes(keyword)
    );
  }

  private static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 7) return phoneNumber;
    return phoneNumber.slice(0, 4) + '****' + phoneNumber.slice(-2);
  }
}