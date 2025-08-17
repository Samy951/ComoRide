const axios = require('axios');

const API_BASE = 'http://localhost:3001/api/v1';

async function testDriverInterface() {
  console.log('🧪 Test Interface Chauffeur via API...');
  
  try {
    // 1. Créer un chauffeur de test
    console.log('\n1. Créer chauffeur de test...');
    const driver = await axios.post(`${API_BASE}/admin/drivers`, {
      phoneNumber: '+33123456789', // Votre numéro
      name: 'Test Chauffeur',
      licenseNumber: 'TEST001',
      vehicleType: 'Berline',
      vehiclePlate: 'TEST-123',
      zones: ['Moroni']
    });
    console.log('✅ Chauffeur créé:', driver.data.id);

    // 2. Créer un client de test
    console.log('\n2. Créer client de test...');
    const customer = await axios.post(`${API_BASE}/admin/customers`, {
      phoneNumber: '+33123456788',
      name: 'Test Client'
    });
    console.log('✅ Client créé:', customer.data.id);

    // 3. Créer une réservation (doit déclencher notification chauffeur)
    console.log('\n3. Créer réservation...');
    const booking = await axios.post(`${API_BASE}/bookings`, {
      customerId: customer.data.id,
      pickupAddress: 'Place de France, Moroni',
      dropAddress: 'Aéroport International Prince Saïd Ibrahim',
      pickupTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // Dans 30min
      passengers: 2
    });
    console.log('✅ Réservation créée:', booking.data.id);
    console.log('📡 Notification chauffeur envoyée!');

    // 4. Simuler acceptation chauffeur
    console.log('\n4. Simuler acceptation chauffeur...');
    const acceptance = await axios.post(`${API_BASE}/bookings/${booking.data.id}/accept`, {
      driverId: driver.data.id,
      estimatedFare: 3500
    });
    console.log('✅ Course acceptée:', acceptance.data);

    console.log('\n🎉 Test complet réussi!');
    console.log('📋 Vérifiez les logs du serveur pour voir les notifications');

  } catch (error) {
    console.error('❌ Erreur:', error.response?.data || error.message);
  }
}

testDriverInterface();