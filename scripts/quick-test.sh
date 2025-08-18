#!/bin/bash

# SCRIPT DE TEST RAPIDE - TICKET-007
# Teste le système de matching avec des données simulées

set -e

API_BASE="${API_BASE:-http://localhost:3000}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚗 COMO RIDE - TEST RAPIDE TICKET-007${NC}"
echo "=============================================="

# Vérifier que le serveur répond
echo -e "\n${YELLOW}🔍 Vérification du serveur...${NC}"
if curl -s "${API_BASE}/api/health" > /dev/null; then
    echo -e "${GREEN}✓ Serveur accessible${NC}"
else
    echo -e "${RED}❌ Serveur non accessible sur ${API_BASE}${NC}"
    echo "Démarrez le serveur avec: npm run dev"
    exit 1
fi

# Variables
CUSTOMER_PHONE="+269777888999"
DRIVER1_PHONE="+269111111111"
DRIVER2_PHONE="+269222222222"

echo -e "\n${YELLOW}📋 Création des données de test...${NC}"

# Créer client
echo "Création du client..."
CUSTOMER_RESPONSE=$(curl -s -X POST "${API_BASE}/api/customers" \
    -H "Content-Type: application/json" \
    -d "{
        \"phoneNumber\": \"${CUSTOMER_PHONE}\",
        \"name\": \"Client Test Quick\"
    }" || echo '{"error": "failed"}')

if echo "$CUSTOMER_RESPONSE" | grep -q "error"; then
    echo -e "${YELLOW}⚠️ Client existe déjà ou erreur${NC}"
else
    echo -e "${GREEN}✓ Client créé${NC}"
fi

# Créer chauffeur 1
echo "Création chauffeur 1..."
DRIVER1_RESPONSE=$(curl -s -X POST "${API_BASE}/api/drivers" \
    -H "Content-Type: application/json" \
    -d "{
        \"phoneNumber\": \"${DRIVER1_PHONE}\",
        \"name\": \"Ahmed Quick Test\",
        \"vehicleType\": \"Sedan\",
        \"vehiclePlate\": \"COM-QUICK1\",
        \"isAvailable\": true,
        \"isVerified\": true,
        \"isActive\": true,
        \"isOnline\": true,
        \"currentLat\": -11.7,
        \"currentLng\": 43.25,
        \"zones\": [\"Moroni\"],
        \"rating\": 4.5
    }" || echo '{"error": "failed"}')

if echo "$DRIVER1_RESPONSE" | grep -q "error"; then
    echo -e "${YELLOW}⚠️ Chauffeur 1 existe déjà ou erreur${NC}"
else
    echo -e "${GREEN}✓ Chauffeur 1 créé${NC}"
fi

# Créer chauffeur 2
echo "Création chauffeur 2..."
DRIVER2_RESPONSE=$(curl -s -X POST "${API_BASE}/api/drivers" \
    -H "Content-Type: application/json" \
    -d "{
        \"phoneNumber\": \"${DRIVER2_PHONE}\",
        \"name\": \"Fatima Quick Test\",
        \"vehicleType\": \"SUV\",
        \"vehiclePlate\": \"COM-QUICK2\",
        \"isAvailable\": true,
        \"isVerified\": true,
        \"isActive\": true,
        \"isOnline\": true,
        \"currentLat\": -11.72,
        \"currentLng\": 43.26,
        \"zones\": [\"Moroni\"],
        \"rating\": 4.7
    }" || echo '{"error": "failed"}')

if echo "$DRIVER2_RESPONSE" | grep -q "error"; then
    echo -e "${YELLOW}⚠️ Chauffeur 2 existe déjà ou erreur${NC}"
else
    echo -e "${GREEN}✓ Chauffeur 2 créé${NC}"
fi

# Créer booking
echo -e "\n${YELLOW}📱 Création d'une demande de course...${NC}"
BOOKING_RESPONSE=$(curl -s -X POST "${API_BASE}/api/bookings" \
    -H "Content-Type: application/json" \
    -d "{
        \"customerPhone\": \"${CUSTOMER_PHONE}\",
        \"pickupAddress\": \"Moroni Centre - Test Rapide\",
        \"destinationAddress\": \"Aéroport - Test Rapide\",
        \"pickupLat\": -11.7,
        \"pickupLng\": 43.25,
        \"destinationLat\": -11.53,
        \"destinationLng\": 43.27,
        \"estimatedFare\": 2500
    }")

BOOKING_ID=$(echo "$BOOKING_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$BOOKING_ID" ]; then
    echo -e "${RED}❌ Erreur création booking${NC}"
    echo "$BOOKING_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Booking créé: ${BOOKING_ID}${NC}"

# Démarrer matching
echo -e "\n${YELLOW}🔍 Démarrage du matching...${NC}"
MATCHING_RESPONSE=$(curl -s -X POST "${API_BASE}/api/matching/start" \
    -H "Content-Type: application/json" \
    -d "{\"bookingId\": \"${BOOKING_ID}\"}")

echo "$MATCHING_RESPONSE" | grep -q '"success":true' || {
    echo -e "${RED}❌ Erreur démarrage matching${NC}"
    echo "$MATCHING_RESPONSE"
    exit 1
}

DRIVERS_NOTIFIED=$(echo "$MATCHING_RESPONSE" | grep -o '"driversNotified":[0-9]*' | cut -d':' -f2)
echo -e "${GREEN}✓ Matching démarré: ${DRIVERS_NOTIFIED} chauffeurs notifiés${NC}"

# Récupérer les IDs des chauffeurs
DRIVER1_ID=$(curl -s "${API_BASE}/api/drivers?phone=${DRIVER1_PHONE}" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
DRIVER2_ID=$(curl -s "${API_BASE}/api/drivers?phone=${DRIVER2_PHONE}" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$DRIVER1_ID" ] || [ -z "$DRIVER2_ID" ]; then
    echo -e "${YELLOW}⚠️ Impossible de récupérer les IDs des chauffeurs${NC}"
    echo "Driver1 ID: $DRIVER1_ID"
    echo "Driver2 ID: $DRIVER2_ID"
fi

# Simuler des réponses
echo -e "\n${YELLOW}🚗 Simulation des réponses des chauffeurs...${NC}"

# Chauffeur 1 rejette (après 3 secondes)
echo "Chauffeur 1 rejette..."
sleep 3
RESPONSE1=$(curl -s -X POST "${API_BASE}/api/matching/response" \
    -H "Content-Type: application/json" \
    -d "{
        \"bookingId\": \"${BOOKING_ID}\",
        \"driverId\": \"${DRIVER1_ID}\",
        \"response\": {
            \"type\": \"REJECT\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\",
            \"responseTime\": 3000
        }
    }")

echo "$RESPONSE1" | grep -q '"success":true' && echo -e "${GREEN}✓ Chauffeur 1 a rejeté${NC}" || echo -e "${RED}❌ Erreur rejet chauffeur 1${NC}"

# Chauffeur 2 accepte (après 2 secondes)
echo "Chauffeur 2 accepte..."
sleep 2
RESPONSE2=$(curl -s -X POST "${API_BASE}/api/matching/response" \
    -H "Content-Type: application/json" \
    -d "{
        \"bookingId\": \"${BOOKING_ID}\",
        \"driverId\": \"${DRIVER2_ID}\",
        \"response\": {
            \"type\": \"ACCEPT\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\",
            \"responseTime\": 2000
        }
    }")

if echo "$RESPONSE2" | grep -q '"action":"ASSIGNED"'; then
    echo -e "${GREEN}✓ Chauffeur 2 a accepté et été assigné !${NC}"
elif echo "$RESPONSE2" | grep -q '"action":"ALREADY_TAKEN"'; then
    echo -e "${YELLOW}⚠️ Course déjà prise par un autre chauffeur${NC}"
else
    echo -e "${RED}❌ Erreur acceptation chauffeur 2${NC}"
    echo "$RESPONSE2"
fi

# Vérifier le statut final
echo -e "\n${YELLOW}📊 Vérification du statut final...${NC}"
FINAL_STATUS=$(curl -s "${API_BASE}/api/bookings/${BOOKING_ID}")

if echo "$FINAL_STATUS" | grep -q '"status":"ACCEPTED"'; then
    DRIVER_NAME=$(echo "$FINAL_STATUS" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✅ SUCCÈS: Course assignée au chauffeur ${DRIVER_NAME}${NC}"
else
    echo -e "${YELLOW}⏳ Booking toujours en attente ou autre statut${NC}"
fi

# Afficher les métriques
echo -e "\n${YELLOW}📈 Métriques système...${NC}"
METRICS=$(curl -s "${API_BASE}/api/health/metrics")
ACTIVE_MATCHINGS=$(echo "$METRICS" | grep -o '"activeMatchings":[0-9]*' | cut -d':' -f2)
SYSTEM_HEALTH=$(echo "$METRICS" | grep -o '"overall":"[^"]*"' | cut -d'"' -f4)

echo -e "${BLUE}📊 Matchings actifs: ${ACTIVE_MATCHINGS}${NC}"
echo -e "${BLUE}🔋 Santé système: ${SYSTEM_HEALTH}${NC}"

echo -e "\n${GREEN}🎉 Test rapide terminé !${NC}"
echo -e "${BLUE}💡 Pour des tests plus détaillés: node scripts/test-simulation.js${NC}"
echo -e "${BLUE}📖 Guide complet: scripts/manual-test-guide.md${NC}"