#!/usr/bin/env node

/**
 * CRÉATION DONNÉES DE TEST SÉCURISÉES
 * Utilise des numéros fictifs uniquement
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// NUMÉROS FICTIFS SEULEMENT - NE PAS UTILISER DE VRAIS NUMÉROS
const TEST_CUSTOMERS = [
  {
    phoneNumber: '+26901000001', // FICTIF
    name: 'Client Test 1'
  },
  {
    phoneNumber: '+26901000002', // FICTIF
    name: 'Client Test 2'
  }
];

const TEST_DRIVERS = [
  {
    phoneNumber: '+26901100001', // FICTIF
    name: 'Ahmed Test Driver',
    vehicleType: 'Sedan',
    vehiclePlate: 'TEST-001',
    currentLat: -11.7,
    currentLng: 43.25,
    isAvailable: true,
    isVerified: true,
    isActive: true,
    isOnline: true,
    rating: 4.5,
    zones: ['Moroni']
  },
  {
    phoneNumber: '+26901100002', // FICTIF
    name: 'Fatima Test Driver',
    vehicleType: 'SUV',
    vehiclePlate: 'TEST-002',
    currentLat: -11.72,
    currentLng: 43.26,
    isAvailable: true,
    isVerified: true,
    isActive: true,
    isOnline: true,
    rating: 4.7,
    zones: ['Moroni']
  },
  {
    phoneNumber: '+26901100003', // FICTIF
    name: 'Said Test Driver',
    vehicleType: 'Taxi',
    vehiclePlate: 'TEST-003',
    currentLat: -11.75,
    currentLng: 43.28,
    isAvailable: true,
    isVerified: true,
    isActive: true,
    isOnline: true,
    rating: 4.3,
    zones: ['Moroni']
  }
];

async function cleanTestData() {
  console.log('🧹 Nettoyage des données de test...');
  
  try {
    // Supprimer les données liées aux numéros de test
    const testPhones = [
      ...TEST_CUSTOMERS.map(c => c.phoneNumber),
      ...TEST_DRIVERS.map(d => d.phoneNumber)
    ];
    
    // Supprimer bookings et données associées
    await prisma.booking.deleteMany({
      where: {
        OR: [
          {
            customer: {
              phoneNumber: { in: testPhones }
            }
          },
          {
            driver: {
              phoneNumber: { in: testPhones }
            }
          }
        ]
      }
    });
    
    // Supprimer les notifications
    await prisma.bookingNotification.deleteMany({});
    await prisma.matchingMetrics.deleteMany({});
    
    // Supprimer les sessions utilisateur
    await prisma.userSession.deleteMany({
      where: { phoneNumber: { in: testPhones } }
    });
    
    // Supprimer customers et drivers de test
    await prisma.customer.deleteMany({
      where: { phoneNumber: { in: testPhones } }
    });
    
    await prisma.driver.deleteMany({
      where: { phoneNumber: { in: testPhones } }
    });
    
    console.log('✅ Nettoyage terminé');
    
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
    throw error;
  }
}

async function createTestData() {
  console.log('📋 Création des données de test sécurisées...');
  
  try {
    // Créer clients de test
    for (const customerData of TEST_CUSTOMERS) {
      await prisma.customer.create({
        data: customerData
      });
      console.log(`✅ Client créé: ${customerData.name} (${customerData.phoneNumber})`);
    }
    
    // Créer chauffeurs de test
    for (const driverData of TEST_DRIVERS) {
      await prisma.driver.create({
        data: {
          ...driverData,
          lastSeenAt: new Date()
        }
      });
      console.log(`✅ Chauffeur créé: ${driverData.name} (${driverData.phoneNumber})`);
    }
    
    console.log('\n🎉 Données de test créées avec succès !');
    console.log('\n📱 NUMÉROS DE TEST FICTIFS:');
    console.log('👥 Clients:');
    TEST_CUSTOMERS.forEach(c => console.log(`   ${c.phoneNumber} - ${c.name}`));
    console.log('🚗 Chauffeurs:');
    TEST_DRIVERS.forEach(d => console.log(`   ${d.phoneNumber} - ${d.name}`));
    
    console.log('\n⚠️  IMPORTANT: Ces numéros sont FICTIFS et ne peuvent pas recevoir de vrais messages WhatsApp');
    console.log('   Utilisez les scripts de simulation pour tester le système');
    
  } catch (error) {
    console.error('❌ Erreur création:', error);
    throw error;
  }
}

async function main() {
  try {
    const command = process.argv[2];
    
    if (command === 'clean') {
      await cleanTestData();
    } else if (command === 'create') {
      await createTestData();
    } else {
      // Par défaut : nettoyer puis créer
      await cleanTestData();
      await createTestData();
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  cleanTestData,
  createTestData,
  TEST_CUSTOMERS,
  TEST_DRIVERS
};