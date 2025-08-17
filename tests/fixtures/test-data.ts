import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedTestData = async () => {
  // Create test customer
  await prisma.customer.create({
    data: {
      id: 'customer-test-1',
      phoneNumber: '+2693123456',
      name: 'Client Test',
      rating: 4.5
    }
  });

  // Create test driver
  await prisma.driver.create({
    data: {
      id: 'driver-test-1',
      phoneNumber: '+2693987654',
      name: 'Chauffeur Test',
      licenseNumber: 'LIC123456',
      vehicleType: 'Berline',
      vehiclePlate: 'ABC-123',
      rating: 4.8,
      isVerified: true,
      isAvailable: true,
      isOnline: false,
      zones: ['Moroni', 'Mitsamiouli']
    }
  });
};

export const testCustomer = {
  id: 'customer-test-1',
  phoneNumber: '+2693123456',
  name: 'Client Test'
};

export const testDriver = {
  id: 'driver-test-1',
  phoneNumber: '+2693987654',
  name: 'Chauffeur Test'
};