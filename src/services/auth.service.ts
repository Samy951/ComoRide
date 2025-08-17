import { PrismaClient } from '@prisma/client';
import { AuthUser } from '../types/api.types';

const prisma = new PrismaClient();

export class AuthService {
  static async findUserByPhone(phoneNumber: string): Promise<AuthUser | null> {
    // Recherche customer d'abord
    const customer = await prisma.customer.findUnique({
      where: { phoneNumber },
      select: {
        id: true,
        phoneNumber: true,
        name: true
      }
    });

    if (customer) {
      return {
        ...customer,
        type: 'customer'
      };
    }

    // Puis recherche driver
    const driver = await prisma.driver.findUnique({
      where: { phoneNumber },
      select: {
        id: true,
        phoneNumber: true,
        name: true
      }
    });

    if (driver) {
      return {
        ...driver,
        type: 'driver'
      };
    }

    return null;
  }
}