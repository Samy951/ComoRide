import { PrismaClient, BookingStatus } from '@prisma/client';
import { CreateBookingRequest, AcceptBookingRequest, CancelBookingRequest } from '../schemas/booking.schemas';
import { 
  BookingResponse, 
  BookingDetailsResponse, 
  AcceptBookingResponse, 
  CancelBookingResponse 
} from '../types/api.types';

const prisma = new PrismaClient();

export class BookingService {
  static async createBooking(
    customerId: string,
    data: CreateBookingRequest
  ): Promise<BookingResponse> {
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

    return {
      id: updatedBooking.id,
      status: "CANCELLED",
      cancellationReason: updatedBooking.cancellationReason!,
      updatedAt: updatedBooking.updatedAt.toISOString()
    };
  }

  private static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 7) return phoneNumber;
    return phoneNumber.slice(0, 4) + '****' + phoneNumber.slice(-2);
  }
}