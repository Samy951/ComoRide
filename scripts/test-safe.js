#!/usr/bin/env node

/**
 * SCRIPT DE TEST SÉCURISÉ - TICKET-007
 * Utilise uniquement des numéros fictifs
 */

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { cleanTestData, createTestData, TEST_CUSTOMERS, TEST_DRIVERS } = require('./create-test-data');

const prisma = new PrismaClient();

// Configuration
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

// Couleurs pour console
const colors = {
  reset: '\x1b[0m',
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

async function simulateBookingRequest() {
  log('cyan', '\n📱 TEST: Simulation d\'une demande de course...');
  
  try {
    const customer = TEST_CUSTOMERS[0];
    
    // Créer une demande de course
    const bookingData = {
      customerPhone: customer.phoneNumber,
      pickupAddress: 'Moroni Centre - Test',
      destinationAddress: 'Aéroport - Test', 
      pickupLat: -11.7,
      pickupLng: 43.25,
      destinationLat: -11.53,
      destinationLng: 43.27,
      estimatedFare: 2500
    };
    
    const response = await axios.post(`${API_BASE}/api/bookings`, bookingData);
    const booking = response.data;
    
    log('green', `✅ Booking créé: ${booking.id}`);
    log('blue', `📍 ${booking.pickupAddress} → ${booking.destinationAddress}`);
    log('blue', `💰 Prix: ${booking.estimatedFare} KMF`);
    
    return booking;
    
  } catch (error) {
    log('red', `❌ Erreur création booking: ${error.response?.data?.message || error.message}`);
    throw error;
  }
}

async function simulateDriverAcceptance(bookingId, driverIndex = 0) {
  log('cyan', `\n🚗 TEST: Simulation acceptation chauffeur ${driverIndex + 1}...`);
  
  try {
    const driver = TEST_DRIVERS[driverIndex];
    
    // Récupérer l'ID du chauffeur
    const driverRecord = await prisma.driver.findUnique({
      where: { phoneNumber: driver.phoneNumber },
      select: { id: true, name: true }
    });
    
    if (!driverRecord) {
      throw new Error(`Chauffeur ${driver.phoneNumber} non trouvé`);
    }
    
    // Simuler une réponse d'acceptation
    const responseData = {
      bookingId,
      driverId: driverRecord.id,
      response: {
        type: 'ACCEPT',
        timestamp: new Date().toISOString(),
        responseTime: Math.random() * 10000 + 2000 // 2-12 secondes
      }
    };
    
    const response = await axios.post(`${API_BASE}/api/matching/response`, responseData);
    const result = response.data;
    
    log('green', `✅ Réponse chauffeur: ${result.action}`);
    log('blue', `📝 Message: ${result.message}`);
    
    return result;
    
  } catch (error) {
    log('red', `❌ Erreur réponse chauffeur: ${error.response?.data?.message || error.message}`);
    return { success: false, action: 'ERROR' };
  }
}

async function simulateDriverRejection(bookingId, driverIndex) {
  log('cyan', `\n🚗 TEST: Simulation rejet chauffeur ${driverIndex + 1}...`);
  
  try {
    const driver = TEST_DRIVERS[driverIndex];
    
    const driverRecord = await prisma.driver.findUnique({
      where: { phoneNumber: driver.phoneNumber },
      select: { id: true, name: true }
    });
    
    if (!driverRecord) {
      throw new Error(`Chauffeur ${driver.phoneNumber} non trouvé`);
    }
    
    const responseData = {
      bookingId,
      driverId: driverRecord.id,
      response: {
        type: 'REJECT',
        timestamp: new Date().toISOString(),
        responseTime: Math.random() * 5000 + 1000
      }
    };
    
    const response = await axios.post(`${API_BASE}/api/matching/response`, responseData);
    const result = response.data;
    
    log('yellow', `⚠️ Chauffeur a rejeté: ${result.action}`);
    
    return result;
    
  } catch (error) {
    log('red', `❌ Erreur rejet chauffeur: ${error.response?.data?.message || error.message}`);
    return { success: false, action: 'ERROR' };
  }
}

async function checkBookingStatus(bookingId) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        driver: {
          select: { name: true, phoneNumber: true, vehicleType: true, vehiclePlate: true }
        },
        customer: {
          select: { name: true, phoneNumber: true }
        },
        metrics: true
      }
    });
    
    if (!booking) {
      log('red', '❌ Booking non trouvé');
      return null;
    }
    
    log('cyan', '\n📊 STATUT FINAL:');
    log('blue', `🆔 ID: ${booking.id}`);
    log('blue', `📍 ${booking.pickupAddress} → ${booking.dropAddress}`);
    log('blue', `👤 Client: ${booking.customer.name} (${booking.customer.phoneNumber})`);
    log('blue', `📅 Statut: ${booking.status}`);
    
    if (booking.driver) {
      log('green', `🚗 Chauffeur assigné: ${booking.driver.name}`);
      log('green', `📞 Contact: ${booking.driver.phoneNumber}`);
      log('green', `🚙 Véhicule: ${booking.driver.vehicleType} - ${booking.driver.vehiclePlate}`);
    } else {
      log('yellow', '⏳ Aucun chauffeur assigné');
    }
    
    if (booking.metrics) {
      log('blue', `📈 Chauffeurs notifiés: ${booking.metrics.totalDriversNotified}`);
      log('blue', `📈 Chauffeurs ayant répondu: ${booking.metrics.totalDriversResponded || 0}`);
      if (booking.metrics.timeToMatch) {
        log('blue', `⏱️ Temps de matching: ${booking.metrics.timeToMatch}s`);
      }
      log('blue', `📊 Statut matching: ${booking.metrics.finalStatus}`);
    }
    
    return booking;
    
  } catch (error) {
    log('red', `❌ Erreur vérification statut: ${error.message}`);
    return null;
  }
}

async function getSystemMetrics() {
  try {
    const response = await axios.get(`${API_BASE}/api/health/metrics`);
    const metrics = response.data;
    
    log('cyan', '\n📊 MÉTRIQUES SYSTÈME:');
    log('blue', `⚡ Santé globale: ${metrics.overall}`);
    log('blue', `🔄 Matchings actifs: ${metrics.activeMatchings}`);
    log('blue', `📈 Bookings récents (1h): ${metrics.recentBookings}`);
    log('blue', `🚗 Chauffeurs actifs: ${metrics.activeDrivers}`);
    log('blue', `⏱️ Temps moyen matching (1h): ${metrics.performance.averageMatchingTime1h}`);
    log('blue', `⏰ Taux timeout (1h): ${metrics.performance.timeoutRate1h}`);
    
    return metrics;
    
  } catch (error) {
    log('yellow', `⚠️ Métriques non disponibles: ${error.message}`);
    return null;
  }
}

// SCÉNARIOS DE TEST

async function testScenario1_SimpleAcceptance() {
  log('magenta', '\n' + '='.repeat(60));
  log('magenta', '🎯 SCÉNARIO 1: Acceptation simple (premier chauffeur)');
  log('magenta', '='.repeat(60));
  
  // Créer booking
  const booking = await simulateBookingRequest();
  
  // Attendre un peu pour que le matching démarre
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Premier chauffeur accepte
  await simulateDriverAcceptance(booking.id, 0);
  
  // Vérifier le résultat
  await new Promise(resolve => setTimeout(resolve, 1000));
  await checkBookingStatus(booking.id);
  await getSystemMetrics();
  
  return booking.id;
}

async function testScenario2_RaceCondition() {
  log('magenta', '\n' + '='.repeat(60));
  log('magenta', '🎯 SCÉNARIO 2: Race condition (2 chauffeurs acceptent)');
  log('magenta', '='.repeat(60));
  
  const booking = await simulateBookingRequest();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Deux chauffeurs acceptent simultanément
  const [result1, result2] = await Promise.all([
    simulateDriverAcceptance(booking.id, 0),
    simulateDriverAcceptance(booking.id, 1)
  ]);
  
  log('yellow', '\n🏁 RÉSULTATS RACE CONDITION:');
  log('blue', `Chauffeur 1: ${result1.action}`);
  log('blue', `Chauffeur 2: ${result2.action}`);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  await checkBookingStatus(booking.id);
  
  return booking.id;
}

async function testScenario3_RejectionsAndAcceptance() {
  log('magenta', '\n' + '='.repeat(60));
  log('magenta', '🎯 SCÉNARIO 3: Rejets puis acceptation');
  log('magenta', '='.repeat(60));
  
  const booking = await simulateBookingRequest();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Premiers chauffeurs rejettent
  await simulateDriverRejection(booking.id, 0);
  await new Promise(resolve => setTimeout(resolve, 1000));
  await simulateDriverRejection(booking.id, 1);
  
  // Dernier chauffeur accepte
  await new Promise(resolve => setTimeout(resolve, 2000));
  await simulateDriverAcceptance(booking.id, 2);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  await checkBookingStatus(booking.id);
  
  return booking.id;
}

async function testHealthEndpoints() {
  log('magenta', '\n' + '='.repeat(60));
  log('magenta', '🎯 TEST: Endpoints de santé');
  log('magenta', '='.repeat(60));
  
  try {
    // Health check
    const healthResponse = await axios.get(`${API_BASE}/api/health`);
    log('green', `✅ Health check: ${healthResponse.data.status}`);
    
    // Métriques détaillées
    await getSystemMetrics();
    
    // Prometheus metrics
    try {
      const prometheusResponse = await axios.get(`${API_BASE}/api/health/prometheus`);
      log('green', '✅ Prometheus metrics disponibles');
      log('blue', `📏 Taille réponse: ${prometheusResponse.data.length} caractères`);
    } catch (error) {
      log('yellow', '⚠️ Prometheus metrics non disponibles');
    }
    
  } catch (error) {
    log('red', `❌ Erreur health checks: ${error.message}`);
  }
}

async function runMainTest() {
  try {
    log('cyan', '\n🔧 INITIALISATION...');
    
    // Vérifier que le serveur répond
    try {
      await axios.get(`${API_BASE}/api/health`);
      log('green', '✅ Serveur accessible');
    } catch (error) {
      throw new Error(`Serveur non accessible sur ${API_BASE}`);
    }
    
    // Nettoyer et créer les données de test
    await cleanTestData();
    await createTestData();
    
    // Attendre que les données soient prêtes
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Lancer les tests
    const scenario = process.argv[2] || '1';
    
    switch (scenario) {
      case '1':
        await testScenario1_SimpleAcceptance();
        break;
      case '2':
        await testScenario2_RaceCondition();
        break;
      case '3':
        await testScenario3_RejectionsAndAcceptance();
        break;
      case 'health':
        await testHealthEndpoints();
        break;
      case 'all':
        await testScenario1_SimpleAcceptance();
        await new Promise(resolve => setTimeout(resolve, 3000));
        await testScenario2_RaceCondition();
        await new Promise(resolve => setTimeout(resolve, 3000));
        await testScenario3_RejectionsAndAcceptance();
        await testHealthEndpoints();
        break;
      default:
        log('yellow', 'Usage: node test-safe.js [1|2|3|health|all]');
        log('blue', '1 - Test acceptation simple');
        log('blue', '2 - Test race condition');
        log('blue', '3 - Test rejets puis acceptation');
        log('blue', 'health - Test endpoints de santé');
        log('blue', 'all - Tous les tests');
    }
    
    log('green', '\n🎉 Tests terminés !');
    
  } catch (error) {
    log('red', `❌ Erreur: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runMainTest();
}

module.exports = {
  simulateBookingRequest,
  simulateDriverAcceptance,
  simulateDriverRejection,
  checkBookingStatus,
  getSystemMetrics
};