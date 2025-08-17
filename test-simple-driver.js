// Test simple interface chauffeur
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSimpleDriver() {
  console.log('🧪 Test Simple Interface Chauffeur...\n');

  try {
    // 1. Créer chauffeur de test
    console.log('1. Création chauffeur...');
    const driver = await prisma.driver.upsert({
      where: { phoneNumber: '+33123456789' }, // Votre numéro
      update: {
        isAvailable: true,
        isOnline: true,
        isVerified: true
      },
      create: {
        phoneNumber: '+33123456789',
        name: 'Test Chauffeur FR',
        licenseNumber: 'FR2024001',
        vehicleType: 'Berline',
        vehiclePlate: 'FR-123-AB',
        rating: 5.0,
        isAvailable: true,
        isOnline: true,
        isVerified: true,
        isActive: true,
        zones: ['Moroni', 'Test Zone']
      }
    });
    console.log('✅ Chauffeur créé/mis à jour:', driver.name);

    // 2. Créer client
    console.log('\n2. Création client...');
    const customer = await prisma.customer.upsert({
      where: { phoneNumber: '+33123456788' },
      update: {},
      create: {
        phoneNumber: '+33123456788',
        name: 'Test Client FR',
        rating: 5.0
      }
    });
    console.log('✅ Client créé:', customer.name);

    // 3. Créer booking pour déclencher notification
    console.log('\n3. Création booking...');
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        pickupAddress: 'Place de France, Moroni',
        dropAddress: 'Aéroport Prince Saïd Ibrahim',
        pickupTime: new Date(Date.now() + 30 * 60 * 1000), // Dans 30min
        passengers: 2,
        estimatedFare: 3500,
        status: 'PENDING'
      }
    });
    console.log('✅ Booking créé:', booking.id);

    // 4. Simuler acceptation
    console.log('\n4. Simulation acceptation chauffeur...');
    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        driverId: driver.id,
        status: 'ACCEPTED'
      },
      include: {
        driver: true,
        customer: true
      }
    });
    console.log('✅ Booking accepté par:', updatedBooking.driver.name);

    // 5. Afficher statut chauffeur
    console.log('\n📊 Statut chauffeur:');
    const driverStatus = await prisma.driver.findUnique({
      where: { id: driver.id },
      include: {
        bookings: {
          where: { status: 'ACCEPTED' },
          include: { customer: true }
        }
      }
    });
    
    console.log(`   📱 Nom: ${driverStatus.name}`);
    console.log(`   📞 Téléphone: ${driverStatus.phoneNumber}`);
    console.log(`   🟢 Disponible: ${driverStatus.isAvailable ? 'OUI' : 'NON'}`);
    console.log(`   ✅ Vérifié: ${driverStatus.isVerified ? 'OUI' : 'NON'}`);
    console.log(`   🚗 Courses actives: ${driverStatus.bookings.length}`);

    if (driverStatus.bookings.length > 0) {
      console.log('\n📋 Courses en cours:');
      driverStatus.bookings.forEach((booking, i) => {
        console.log(`   ${i+1}. ${booking.customer.name}`);
        console.log(`      📍 ${booking.pickupAddress} → ${booking.dropAddress}`);
        console.log(`      💰 ${booking.estimatedFare} KMF`);
      });
    }

    console.log('\n🎉 Test terminé avec succès!');
    console.log('\n📱 Maintenant que WhatsApp est connecté:');
    console.log(`   - Envoyez "menu" depuis ${driver.phoneNumber} pour voir le menu chauffeur`);
    console.log(`   - Envoyez "menu" depuis ${customer.phoneNumber} pour voir le menu client`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSimpleDriver();