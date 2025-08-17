import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed with realistic Comorian data...');

  // Clean existing data
  await prisma.transaction.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.customer.deleteMany();

  // Create customers with valid Comorian phone numbers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        phoneNumber: '+2693321234',
        name: 'Ali Mohamed Said',
        rating: 4.8,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '+2693345678',
        name: 'Fatima Said Abdou',
        rating: 5.0,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '+2693367890',
        name: 'Ibrahim Abdou Hassan',
        rating: 4.5,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '+2693412345',
        name: 'Zainaba Mohamed Ali',
        rating: 4.9,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '+2693456789',
        name: 'Samir Hassan Mohamed',
        rating: 4.6,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '+2693498765',
        name: 'Amina Said Ibrahim',
        rating: 4.7,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '+2693534567',
        name: 'Mohamed Ali Hassan',
        rating: 5.0,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '+2693567890',
        name: 'Halima Ibrahim Said',
        rating: 4.4,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '+2693601234',
        name: 'Ahmed Mohamed Abdou',
        rating: 4.3,
      },
    }),
    prisma.customer.create({
      data: {
        phoneNumber: '+2693634567',
        name: 'Maryam Hassan Ali',
        rating: 4.8,
      },
    }),
  ]);

  console.log(`✅ Created ${customers.length} customers`);

  // Create drivers with GPS coordinates and new fields
  const drivers = await Promise.all([
    prisma.driver.create({
      data: {
        phoneNumber: '+2693398765',
        name: 'Ahmed Soilihi Mohamed',
        licenseNumber: 'KM2024001',
        vehicleType: 'Sedan Toyota',
        vehiclePlate: 'AB-123-KM',
        rating: 4.7,
        isAvailable: true,
        isOnline: true,
        isVerified: true,
        zones: ['Moroni', 'Iconi', 'Foumbouni'],
        currentLat: -11.7042,
        currentLng: 43.2402,
        lastSeenAt: new Date(),
      },
    }),
    prisma.driver.create({
      data: {
        phoneNumber: '+2693387654',
        name: 'Moussa Ali Hassan',
        licenseNumber: 'KM2024002',
        vehicleType: 'SUV Nissan',
        vehiclePlate: 'CD-456-KM',
        rating: 4.9,
        isAvailable: true,
        isOnline: true,
        isVerified: true,
        zones: ['Moroni', 'Mitsamiouli', 'Mbeni'],
        currentLat: -11.6853,
        currentLng: 43.2567,
        lastSeenAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      },
    }),
    prisma.driver.create({
      data: {
        phoneNumber: '+2693376543',
        name: 'Samir Hassane Said',
        licenseNumber: 'KM2024003',
        vehicleType: 'Minibus Hyundai',
        vehiclePlate: 'EF-789-KM',
        rating: 4.6,
        isAvailable: false,
        isOnline: false,
        isVerified: true,
        zones: ['Moroni', 'Mutsamudu'],
        currentLat: -11.7056,
        currentLng: 43.2419,
        lastSeenAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      },
    }),
    prisma.driver.create({
      data: {
        phoneNumber: '+2693365432',
        name: 'Ibrahim Mohamed Ali',
        licenseNumber: 'KM2024004',
        vehicleType: 'Sedan Peugeot',
        vehiclePlate: 'GH-012-KM',
        rating: 4.8,
        isAvailable: true,
        isOnline: true,
        isVerified: true,
        zones: ['Mutsamudu', 'Mbeni'],
        currentLat: -12.1667,
        currentLng: 44.4167, // Mutsamudu coordinates
        lastSeenAt: new Date(),
      },
    }),
    prisma.driver.create({
      data: {
        phoneNumber: '+2693354321',
        name: 'Hassan Said Mohamed',
        licenseNumber: 'KM2024005',
        vehicleType: 'SUV Toyota',
        vehiclePlate: 'IJ-345-KM',
        rating: 4.5,
        isAvailable: true,
        isOnline: false,
        isVerified: true,
        zones: ['Fomboni', 'Moroni'],
        currentLat: -12.2833,
        currentLng: 43.7333, // Fomboni coordinates
        lastSeenAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      },
    }),
    prisma.driver.create({
      data: {
        phoneNumber: '+2693343210',
        name: 'Mohamed Hassan Ibrahim',
        licenseNumber: 'KM2024006',
        vehicleType: 'Minibus Ford',
        vehiclePlate: 'KL-678-KM',
        rating: 4.4,
        isAvailable: false,
        isOnline: false,
        isVerified: false, // Not verified yet
        zones: ['Moroni'],
        lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
    }),
    prisma.driver.create({
      data: {
        phoneNumber: '+2693332109',
        name: 'Ali Ibrahim Hassan',
        licenseNumber: 'KM2024007',
        vehicleType: 'Sedan Renault',
        vehiclePlate: 'MN-901-KM',
        rating: 4.9,
        isAvailable: true,
        isOnline: true,
        isVerified: true,
        zones: ['Mitsamiouli', 'Iconi'],
        currentLat: -11.3833,
        currentLng: 43.2833, // Mitsamiouli coordinates
        lastSeenAt: new Date(),
      },
    }),
    prisma.driver.create({
      data: {
        phoneNumber: '+2693321098',
        name: 'Said Mohamed Hassan',
        licenseNumber: 'KM2024008',
        vehicleType: 'SUV Honda',
        vehiclePlate: 'OP-234-KM',
        rating: 4.3,
        isAvailable: true,
        isOnline: true,
        isVerified: true,
        zones: ['Mbeni', 'Foumbouni'],
        currentLat: -11.7167,
        currentLng: 43.2833,
        lastSeenAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      },
    }),
  ]);

  console.log(`✅ Created ${drivers.length} drivers`);

  // Create diverse bookings with GPS coordinates
  const bookings = [];

  // ACCEPTED booking
  const booking1 = await prisma.booking.create({
    data: {
      customerId: customers[0].id,
      driverId: drivers[0].id,
      pickupAddress: 'Place de France, Moroni',
      dropAddress: 'Aéroport Prince Said Ibrahim',
      pickupLat: -11.7042,
      pickupLng: 43.2402,
      dropLat: -11.5336,
      dropLng: 43.2719,
      pickupTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      passengers: 2,
      status: 'ACCEPTED',
      notes: 'J\'ai deux valises, merci',
      estimatedFare: 3500,
    },
  });
  bookings.push(booking1);

  // PENDING booking
  const booking2 = await prisma.booking.create({
    data: {
      customerId: customers[1].id,
      pickupAddress: 'Itsandra Plage, Moroni',
      dropAddress: 'Marché Volo Volo',
      pickupLat: -11.6833,
      pickupLng: 43.2167,
      dropLat: -11.7056,
      dropLng: 43.2419,
      pickupTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      passengers: 1,
      status: 'PENDING',
      estimatedFare: 800,
    },
  });
  bookings.push(booking2);

  // CANCELLED booking with reason
  const booking3 = await prisma.booking.create({
    data: {
      customerId: customers[2].id,
      driverId: drivers[1].id,
      pickupAddress: 'Hôtel Golden Tulip, Moroni',
      dropAddress: 'Port de Moroni',
      pickupLat: -11.6967,
      pickupLng: 43.2544,
      dropLat: -11.7072,
      dropLng: 43.2558,
      pickupTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      passengers: 3,
      status: 'CANCELLED',
      cancellationReason: 'Client ne répond plus au téléphone',
      estimatedFare: 600,
    },
  });
  bookings.push(booking3);

  // COMPLETED booking for trip creation
  const booking4 = await prisma.booking.create({
    data: {
      customerId: customers[3].id,
      driverId: drivers[2].id,
      pickupAddress: 'Gare routière de Moroni',
      dropAddress: 'Université des Comores',
      pickupLat: -11.7089,
      pickupLng: 43.2464,
      dropLat: -11.7411,
      dropLng: 43.2600,
      pickupTime: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      passengers: 1,
      status: 'COMPLETED',
      estimatedFare: 1200,
    },
  });
  bookings.push(booking4);

  // Another PENDING booking in Mutsamudu
  const booking5 = await prisma.booking.create({
    data: {
      customerId: customers[4].id,
      pickupAddress: 'Centre-ville Mutsamudu',
      dropAddress: 'Port de Mutsamudu',
      pickupLat: -12.1667,
      pickupLng: 44.4167,
      dropLat: -12.1703,
      dropLng: 44.4189,
      pickupTime: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
      passengers: 2,
      status: 'PENDING',
      estimatedFare: 500,
    },
  });
  bookings.push(booking5);

  console.log(`✅ Created ${bookings.length} diverse bookings`);

  // Create completed trip with transaction
  const trip = await prisma.trip.create({
    data: {
      bookingId: booking4.id,
      customerId: customers[3].id,
      driverId: drivers[2].id,
      startTime: new Date(Date.now() - 90 * 60 * 1000), // 1.5 hours ago
      endTime: new Date(Date.now() - 75 * 60 * 1000), // 1.25 hours ago
      fare: 1200,
      distance: 3.2,
      paymentMethod: 'CASH',
      paymentStatus: 'COMPLETED',
      customerRating: 5,
      driverRating: 4,
    },
  });

  // Create transaction for the trip
  await prisma.transaction.create({
    data: {
      tripId: trip.id,
      amount: 1200,
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      metadata: {
        duration: '15 minutes',
        distance: '3.2 km',
        route: 'Gare routière → Université des Comores',
      },
    },
  });

  // Create an Orange Money transaction (pending)
  const booking6 = await prisma.booking.create({
    data: {
      customerId: customers[5].id,
      driverId: drivers[3].id,
      pickupAddress: 'Aéroport Prince Said Ibrahim',
      dropAddress: 'Hôtel Retaj, Moroni',
      pickupLat: -11.5336,
      pickupLng: 43.2719,
      dropLat: -11.6967,
      dropLng: 43.2544,
      pickupTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      passengers: 1,
      status: 'COMPLETED',
      estimatedFare: 3500,
    },
  });

  const trip2 = await prisma.trip.create({
    data: {
      bookingId: booking6.id,
      customerId: customers[5].id,
      driverId: drivers[3].id,
      startTime: new Date(Date.now() - 120 * 60 * 1000), // 2 hours ago
      endTime: new Date(Date.now() - 90 * 60 * 1000), // 1.5 hours ago
      fare: 3500,
      distance: 15.8,
      paymentMethod: 'ORANGE_MONEY',
      paymentStatus: 'PENDING',
      customerRating: 4,
      driverRating: 5,
    },
  });

  await prisma.transaction.create({
    data: {
      tripId: trip2.id,
      amount: 3500,
      paymentMethod: 'ORANGE_MONEY',
      status: 'PENDING',
      reference: 'OM2024001234',
      metadata: {
        duration: '30 minutes',
        distance: '15.8 km',
        route: 'Aéroport → Hôtel Retaj',
        orangeMoneyPhone: '+2693456789',
      },
    },
  });

  console.log('✅ Created sample trips with transactions');

  console.log('🎉 Seed completed successfully with realistic Comorian data!');
  console.log(`📊 Summary:
    - ${customers.length} customers with +269 phone numbers
    - ${drivers.length} drivers across different zones
    - ${bookings.length + 1} bookings in various states
    - 2 completed trips with different payment methods
    - GPS coordinates for major Comorian locations`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });