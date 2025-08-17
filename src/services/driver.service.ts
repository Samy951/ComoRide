import { PrismaClient } from '@prisma/client';
import { AvailabilityRequest, LocationRequest } from '../schemas/driver.schemas';
import { AvailabilityResponse, LocationResponse } from '../types/api.types';

const prisma = new PrismaClient();

export class DriverService {
  static async updateAvailability(
    driverId: string, 
    data: AvailabilityRequest
  ): Promise<AvailabilityResponse> {
    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: {
        isAvailable: data.isAvailable,
        isOnline: data.isOnline,
        zones: data.zones || undefined,
        lastSeenAt: new Date()
      },
      select: {
        isAvailable: true,
        isOnline: true,
        zones: true,
        lastSeenAt: true
      }
    });

    return {
      isAvailable: driver.isAvailable,
      isOnline: driver.isOnline,
      zones: driver.zones,
      lastSeenAt: driver.lastSeenAt?.toISOString() || new Date().toISOString()
    };
  }

  static async updateLocation(
    driverId: string,
    data: LocationRequest
  ): Promise<LocationResponse> {
    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: {
        currentLat: data.latitude,
        currentLng: data.longitude,
        lastSeenAt: new Date()
      },
      select: {
        currentLat: true,
        currentLng: true,
        updatedAt: true
      }
    });

    return {
      latitude: driver.currentLat!,
      longitude: driver.currentLng!,
      updatedAt: driver.updatedAt.toISOString()
    };
  }
}