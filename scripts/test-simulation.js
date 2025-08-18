#!/usr/bin/env node

/**
 * SCRIPT DE TEST TICKET-007
 * Simulation complète client-chauffeur pour tester le système de matching
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+269123456789';

// Données de test
const TEST_CUSTOMER = {
  phoneNumber: '+269777888999',
  name: 'Client Test'
};

const TEST_DRIVERS = [
  {
    phoneNumber: '+269111111111',
    name: 'Ahmed Test',
    vehicleType: 'Sedan',
    vehiclePlate: 'COM-001',
    currentLat: -11.7,
    currentLng: 43.25
  },
  {
    phoneNumber: '+269222222222', 
    name: 'Fatima Test',
    vehicleType: 'SUV',
    vehiclePlate: 'COM-002',
    currentLat: -11.72,
    currentLng: 43.26
  },
  {
    phoneNumber: '+269333333333',
    name: 'Said Test', 
    vehicleType: 'Taxi',
    vehiclePlate: 'COM-003',
    currentLat: -11.75,
    currentLng: 43.28
  }
];

const TEST_BOOKING = {
  pickupAddress: 'Moroni Centre',
  destinationAddress: 'Aéroport',
  pickupLat: -11.7,
  pickupLng: 43.25,
  destinationLat: -11.53,
  destinationLng: 43.27,
  estimatedFare: 2500
};

// Couleurs pour console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function setupTestData() {
  log('cyan', '\n🔧 SETUP - Création des données de test...');
  
  try {
    // 1. Créer/Mettre à jour le client
    const customer = await prisma.customer.upsert({
      where: { phoneNumber: TEST_CUSTOMER.phoneNumber },
      update: TEST_CUSTOMER,
      create: TEST_CUSTOMER
    });
    log('green', `✓ Client créé: ${customer.name} (${customer.phoneNumber})`);

    // 2. Créer/Mettre à jour les chauffeurs
    const drivers = [];
    for (const driverData of TEST_DRIVERS) {
      const driver = await prisma.driver.upsert({
        where: { phoneNumber: driverData.phoneNumber },
        update: {
          ...driverData,
          isAvailable: true,
          isVerified: true,
          isActive: true,
          isOnline: true,
          lastSeenAt: new Date(),
          rating: 4.5
        },
        create: {
          ...driverData,
          isAvailable: true,
          isVerified: true,
          isActive: true,
          isOnline: true,
          lastSeenAt: new Date(),
          rating: 4.5,
          zones: ['Moroni', 'Grande Comore']
        }
      });
      drivers.push(driver);
      log('green', `✓ Chauffeur créé: ${driver.name} (${driver.phoneNumber})`);
    }

    return { customer, drivers };
    
  } catch (error) {
    log('red', `❌ Erreur setup: ${error.message}`);
    throw error;
  }
}

async function createTestBooking(customerId) {
  log('cyan', '\n📱 CLIENT - Création d\'une demande de course...');
  
  try {
    const booking = await prisma.booking.create({
      data: {
        ...TEST_BOOKING,
        customerId,
        status: 'PENDING'
      }
    });
    
    log('green', `✓ Booking créé: ${booking.id}`);
    log('blue', `📍 De: ${booking.pickupAddress} vers ${booking.destinationAddress}`);
    log('blue', `💰 Prix estimé: ${booking.estimatedFare} KMF`);
    
    return booking;
    
  } catch (error) {
    log('red', `❌ Erreur création booking: ${error.message}`);
    throw error;
  }
}

async function startMatching(bookingId) {
  log('cyan', '\n🔍 SYSTÈME - Démarrage du matching...');
  
  try {
    const response = await axios.post(`${API_BASE}/api/matching/start`, {
      bookingId
    });
    
    const result = response.data;
    log('green', `✓ Matching démarré: ${result.driversNotified} chauffeurs notifiés`);
    log('blue', `📊 IDs chauffeurs: ${result.driverIds.join(', ')}`);
    
    if (result.errors.length > 0) {
      log('yellow', `⚠️ Erreurs: ${result.errors.join(', ')}`);
    }
    
    return result;
    
  } catch (error) {
    log('red', `❌ Erreur matching: ${error.response?.data?.message || error.message}`);
    throw error;
  }
}

async function simulateDriverResponse(bookingId, driverId, responseType, delay = 0) {
  if (delay > 0) {
    log('yellow', `⏳ Attente ${delay}ms avant réponse du chauffeur ${driverId}...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  log('cyan', `\n🚗 CHAUFFEUR ${driverId} - Réponse: ${responseType}`);
  
  try {
    const response = await axios.post(`${API_BASE}/api/matching/response`, {
      bookingId,
      driverId,
      response: {
        type: responseType,
        timestamp: new Date(),
        responseTime: delay + Math.random() * 5000
      }
    });
    
    const result = response.data;
    log('green', `✓ Réponse enregistrée: ${result.action}`);
    log('blue', `📝 Message: ${result.message}`);
    
    return result;
    
  } catch (error) {
    log('red', `❌ Erreur réponse chauffeur: ${error.response?.data?.message || error.message}`);
    return { success: false, action: 'ERROR', message: error.message };
  }
}

async function checkMatchingStatus(bookingId) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        driver: {
          select: { name: true, phoneNumber: true }
        },
        metrics: true
      }
    });
    
    log('cyan', '\n📊 STATUT MATCHING:');
    log('blue', `Status: ${booking.status}`);
    if (booking.driver) {
      log('green', `✓ Chauffeur assigné: ${booking.driver.name} (${booking.driver.phoneNumber})`);
    }
    if (booking.metrics) {
      log('blue', `📈 Métriques: ${booking.metrics.totalDriversNotified} notifiés, ${booking.metrics.totalDriversResponded || 0} réponses`);
      log('blue', `⏱️ Temps de matching: ${booking.metrics.timeToMatch || 'En cours'}s`);
    }
    
    return booking;
    
  } catch (error) {
    log('red', `❌ Erreur vérification statut: ${error.message}`);
    throw error;
  }
}

async function getMetrics() {
  log('cyan', '\n📊 MÉTRIQUES SYSTÈME:');
  
  try {
    const response = await axios.get(`${API_BASE}/api/health/metrics`);
    const metrics = response.data;
    
    log('green', `✓ Matchings actifs: ${metrics.activeMatchings}`);
    log('blue', `📈 Performance 1h: ${metrics.performance.averageMatchingTime1h}, timeout: ${metrics.performance.timeoutRate1h}`);
    log('blue', `🚗 Chauffeurs actifs: ${metrics.activeDrivers}`);
    log('blue', `🔋 Santé système: ${metrics.overall}`);
    
    return metrics;
    
  } catch (error) {
    log('yellow', `⚠️ Métriques non disponibles: ${error.message}`);
    return null;
  }
}

// SCENARIOS DE TEST

async function scenario1_AcceptanceSimple() {
  log('magenta', '\n' + '='.repeat(50));
  log('magenta', '🎯 SCÉNARIO 1: Acceptation simple (premier chauffeur)');
  log('magenta', '='.repeat(50));
  
  const { customer, drivers } = await setupTestData();
  const booking = await createTestBooking(customer.id);
  
  // Démarrer le matching
  await startMatching(booking.id);
  
  // Premier chauffeur accepte rapidement
  await simulateDriverResponse(booking.id, drivers[0].id, 'ACCEPT', 3000);
  
  // Vérifier le résultat
  await checkMatchingStatus(booking.id);
  await getMetrics();
}

async function scenario2_RaceCondition() {
  log('magenta', '\n' + '='.repeat(50));
  log('magenta', '🎯 SCÉNARIO 2: Race condition (2 chauffeurs acceptent)');
  log('magenta', '='.repeat(50));
  
  const { customer, drivers } = await setupTestData();
  const booking = await createTestBooking(customer.id);
  
  // Démarrer le matching
  await startMatching(booking.id);
  
  // Deux chauffeurs acceptent en même temps
  const responses = await Promise.all([
    simulateDriverResponse(booking.id, drivers[0].id, 'ACCEPT', 2000),
    simulateDriverResponse(booking.id, drivers[1].id, 'ACCEPT', 2100)
  ]);
  
  log('yellow', '\n🏁 RÉSULTATS RACE CONDITION:');
  responses.forEach((result, index) => {
    log('blue', `Chauffeur ${index + 1}: ${result.action} - ${result.message}`);
  });
  
  // Vérifier le résultat
  await checkMatchingStatus(booking.id);
}

async function scenario3_RejectionsAndTimeout() {
  log('magenta', '\n' + '='.repeat(50));
  log('magenta', '🎯 SCÉNARIO 3: Rejets et timeout');
  log('magenta', '='.repeat(50));
  
  const { customer, drivers } = await setupTestData();
  const booking = await createTestBooking(customer.id);
  
  // Démarrer le matching
  await startMatching(booking.id);
  
  // Premiers chauffeurs rejettent
  await simulateDriverResponse(booking.id, drivers[0].id, 'REJECT', 5000);
  await simulateDriverResponse(booking.id, drivers[1].id, 'REJECT', 8000);
  
  // Attendre et voir si timeout se déclenche
  log('yellow', '\n⏳ Attente du timeout (30s pour le dernier chauffeur)...');
  
  // Simuler une longue attente pour voir le timeout
  setTimeout(async () => {
    await checkMatchingStatus(booking.id);
    log('blue', '⏰ Test timeout terminé');
  }, 35000);
  
  // Le dernier chauffeur peut accepter avant timeout
  setTimeout(async () => {
    await simulateDriverResponse(booking.id, drivers[2].id, 'ACCEPT', 1000);
  }, 25000);
}

async function scenario4_NoDriversAvailable() {
  log('magenta', '\n' + '='.repeat(50));
  log('magenta', '🎯 SCÉNARIO 4: Aucun chauffeur disponible');
  log('magenta', '='.repeat(50));
  
  // Désactiver tous les chauffeurs
  await prisma.driver.updateMany({
    where: { phoneNumber: { in: TEST_DRIVERS.map(d => d.phoneNumber) } },
    data: { isAvailable: false }
  });
  
  const { customer } = await setupTestData();
  const booking = await createTestBooking(customer.id);
  
  // Tenter le matching sans chauffeurs
  await startMatching(booking.id);
  
  // Vérifier le résultat
  await checkMatchingStatus(booking.id);
  
  // Réactiver les chauffeurs pour autres tests
  await prisma.driver.updateMany({
    where: { phoneNumber: { in: TEST_DRIVERS.map(d => d.phoneNumber) } },
    data: { isAvailable: true }
  });
}

// MENU INTERACTIF

async function showMenu() {
  console.log('\n' + colors.cyan + '='.repeat(60));
  console.log('🚗 COMO RIDE - SIMULATEUR DE TEST TICKET-007');
  console.log('='.repeat(60) + colors.reset);
  console.log('\n📋 SCÉNARIOS DISPONIBLES:');
  console.log('1️⃣  Acceptation simple (premier chauffeur)');
  console.log('2️⃣  Race condition (2 chauffeurs acceptent)');
  console.log('3️⃣  Rejets et timeout');
  console.log('4️⃣  Aucun chauffeur disponible');
  console.log('5️⃣  Tests personnalisés');
  console.log('6️⃣  Métriques système');
  console.log('7️⃣  Nettoyage base de données');
  console.log('0️⃣  Quitter');
  console.log('\n' + colors.yellow + '⚠️  Assurez-vous que le serveur est démarré sur ' + API_BASE + colors.reset);
}

async function cleanup() {
  log('cyan', '\n🧹 Nettoyage des données de test...');
  
  try {
    // Supprimer les bookings de test
    await prisma.booking.deleteMany({
      where: {
        customer: {
          phoneNumber: TEST_CUSTOMER.phoneNumber
        }
      }
    });
    
    // Supprimer les notifications et métriques
    await prisma.bookingNotification.deleteMany({});
    await prisma.matchingMetrics.deleteMany({});
    
    // Supprimer le client de test
    await prisma.customer.deleteMany({
      where: { phoneNumber: TEST_CUSTOMER.phoneNumber }
    });
    
    // Supprimer les chauffeurs de test
    await prisma.driver.deleteMany({
      where: { phoneNumber: { in: TEST_DRIVERS.map(d => d.phoneNumber) } }
    });
    
    log('green', '✓ Nettoyage terminé');
    
  } catch (error) {
    log('red', `❌ Erreur nettoyage: ${error.message}`);
  }
}

// PROGRAMME PRINCIPAL

async function main() {
  try {
    await showMenu();
    
    // Lecture de l'entrée utilisateur (simplifiée pour le script)
    const scenario = process.argv[2] || '1';
    
    switch (scenario) {
      case '1':
        await scenario1_AcceptanceSimple();
        break;
      case '2':
        await scenario2_RaceCondition();
        break;
      case '3':
        await scenario3_RejectionsAndTimeout();
        break;
      case '4':
        await scenario4_NoDriversAvailable();
        break;
      case '6':
        await getMetrics();
        break;
      case '7':
        await cleanup();
        break;
      default:
        log('yellow', 'Usage: node test-simulation.js [1-7]');
        await showMenu();
    }
    
  } catch (error) {
    log('red', `❌ Erreur: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  setupTestData,
  createTestBooking,
  startMatching,
  simulateDriverResponse,
  checkMatchingStatus,
  cleanup
};