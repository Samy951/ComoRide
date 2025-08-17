import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTestUsers() {
  console.log('🌱 Creating test users...');

  // Create test customers (replace with your actual French numbers)
  const testCustomer = await prisma.customer.upsert({
    where: { phoneNumber: '+33612345678' }, // ⚠️ REPLACE WITH YOUR ACTUAL FRENCH NUMBER
    update: {},
    create: {
      phoneNumber: '+33612345678', // ⚠️ REPLACE WITH YOUR ACTUAL FRENCH NUMBER
      name: 'Test Client FR',
      rating: 5.0
    }
  });

  // Create test drivers (replace with your actual French numbers)
  const testDriver1 = await prisma.driver.upsert({
    where: { phoneNumber: '+33667606792' },
    update: {},
    create: {
      phoneNumber: '+33667606792',
      name: 'Ahmed Chauffeur FR',
      licenseNumber: 'FR2024001',
      vehicleType: 'Berline',
      vehiclePlate: 'FR-123-AB',
      rating: 4.8,
      isAvailable: true,
      isOnline: true,
      isVerified: true,
      isActive: true,
      zones: ['Moroni', 'Itsandra', 'Test Zone FR'],
      currentLat: -11.7022,
      currentLng: 43.2551
    }
  });

  const testDriver2 = await prisma.driver.upsert({
    where: { phoneNumber: '+33612345680' }, // ⚠️ OPTIONAL: 3rd number if you have
    update: {},
    create: {
      phoneNumber: '+33612345680',
      name: 'Farid Taxi FR',
      licenseNumber: 'FR2024002',
      vehicleType: 'SUV',
      vehiclePlate: 'FR-456-CD',
      rating: 4.9,
      isAvailable: true,
      isOnline: true,
      isVerified: true,
      isActive: true,
      zones: ['Mutsamudu', 'Domoni', 'Test Zone FR'],
      currentLat: -12.1667,
      currentLng: 44.4167
    }
  });

  console.log('✅ Test users created:');
  console.log(`📱 Client: ${testCustomer.name} (${testCustomer.phoneNumber})`);
  console.log(`🚗 Chauffeur 1: ${testDriver1.name} (${testDriver1.phoneNumber})`);
  console.log(`🚗 Chauffeur 2: ${testDriver2.name} (${testDriver2.phoneNumber})`);
  
  console.log('\n📋 Instructions de test:');
  console.log('1. Scannez le QR code avec WhatsApp');
  console.log('2. Envoyez "menu" depuis le numéro chauffeur pour voir le menu chauffeur');
  console.log('3. Envoyez "menu" depuis le numéro client pour voir le menu client');
  console.log('4. Testez les fonctionnalités :');
  console.log('   - Chauffeur : "disponible", "occupé", "courses"');
  console.log('   - Client : réserver une course pour déclencher notifications');
}

seedTestUsers()
  .catch((e) => {
    console.error('❌ Error seeding test users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });