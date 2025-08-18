# Guide de Test Manuel - TICKET-007 Matching System

## 🎯 Objectif
Ce guide vous permet de tester manuellement le système de matching ComoRide avec des clients et chauffeurs simulés.

## 📋 Prérequis

### 1. Démarrer le serveur
```bash
npm run dev
```

### 2. Installer les dépendances de test (si nécessaire)
```bash
npm install axios
```

### 3. Configurer WhatsApp (optionnel)
- Si vous testez sans WhatsApp, les messages seront loggés uniquement
- Pour WhatsApp réel, scannez le QR code affiché au démarrage

## 🛠️ Tests Automatisés

### Test Simple (Recommandé pour commencer)
```bash
node scripts/test-simulation.js 1
```

### Test Race Condition
```bash
node scripts/test-simulation.js 2
```

### Test Timeouts
```bash
node scripts/test-simulation.js 3
```

### Test Aucun Chauffeur
```bash
node scripts/test-simulation.js 4
```

### Voir les Métriques
```bash
node scripts/test-simulation.js 6
```

### Nettoyer les Données
```bash
node scripts/test-simulation.js 7
```

## 🔧 Tests API Manuels

### 1. Créer des Données de Test

```bash
# Créer un client
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+269777888999",
    "name": "Client Test"
  }'

# Créer des chauffeurs
curl -X POST http://localhost:3000/api/drivers \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+269111111111",
    "name": "Ahmed Test",
    "vehicleType": "Sedan",
    "vehiclePlate": "COM-001",
    "isAvailable": true,
    "isVerified": true,
    "isActive": true,
    "isOnline": true,
    "currentLat": -11.7,
    "currentLng": 43.25,
    "zones": ["Moroni"]
  }'

curl -X POST http://localhost:3000/api/drivers \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+269222222222",
    "name": "Fatima Test",
    "vehicleType": "SUV", 
    "vehiclePlate": "COM-002",
    "isAvailable": true,
    "isVerified": true,
    "isActive": true,
    "isOnline": true,
    "currentLat": -11.72,
    "currentLng": 43.26,
    "zones": ["Moroni"]
  }'
```

### 2. Créer une Demande de Course

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "+269777888999",
    "pickupAddress": "Moroni Centre",
    "destinationAddress": "Aéroport",
    "pickupLat": -11.7,
    "pickupLng": 43.25,
    "destinationLat": -11.53,
    "destinationLng": 43.27,
    "estimatedFare": 2500
  }'
```

**Note:** Récupérer l'ID du booking retourné pour les tests suivants.

### 3. Démarrer le Matching

```bash
curl -X POST http://localhost:3000/api/matching/start \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID_ICI"
  }'
```

### 4. Simuler Réponses des Chauffeurs

**Acceptation:**
```bash
curl -X POST http://localhost:3000/api/matching/response \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID_ICI",
    "driverId": "DRIVER_ID_ICI",
    "response": {
      "type": "ACCEPT",
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'",
      "responseTime": 5000
    }
  }'
```

**Rejet:**
```bash
curl -X POST http://localhost:3000/api/matching/response \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID_ICI", 
    "driverId": "DRIVER_ID_ICI",
    "response": {
      "type": "REJECT",
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'",
      "responseTime": 3000
    }
  }'
```

### 5. Vérifier le Statut

```bash
# Statut du booking
curl http://localhost:3000/api/bookings/BOOKING_ID_ICI

# Métriques système
curl http://localhost:3000/api/health/metrics

# Health check
curl http://localhost:3000/api/health
```

## 📊 Tests de Performance

### Test de Charge (optionnel)
```bash
# Installer artillery si pas déjà fait
npm install -g artillery

# Créer un fichier de test de charge
cat > load-test.yml << EOF
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5
scenarios:
  - name: "Matching stress test"
    flow:
      - post:
          url: "/api/matching/start"
          json:
            bookingId: "test-booking-{{ \$randomString() }}"
EOF

# Lancer le test
artillery run load-test.yml
```

## 🔍 Points de Test Importants

### ✅ Fonctionnalités à Valider

1. **Broadcast à TOUS les chauffeurs disponibles**
   - Vérifier que tous les chauffeurs reçoivent la notification
   - Pas de limite de 5 chauffeurs

2. **Verrouillage optimiste (race conditions)**
   - Faire accepter 2+ chauffeurs simultanément
   - Seul le premier doit être assigné

3. **Timeouts intelligents**
   - 30s par chauffeur individuel
   - 5min global avec alerte admin

4. **Notifications temps réel**
   - Client informé du démarrage de recherche
   - Client informé quand chauffeur trouvé
   - Autres chauffeurs informés que course prise

5. **Métriques et monitoring**
   - Temps de matching trackés
   - Taux d'acceptation calculés
   - Métriques de santé système

### 🚨 Scénarios d'Erreur à Tester

1. **Aucun chauffeur disponible**
   - Client doit être notifié immédiatement
   - Statut TIMEOUT dans métriques

2. **Chauffeur non connecté**
   - Système doit gérer les erreurs d'envoi
   - Continuer avec autres chauffeurs

3. **Timeout global**
   - Admin doit recevoir alerte
   - Client informé de l'échec

4. **Race conditions multiples**
   - Tester avec 3+ chauffeurs acceptant
   - Vérifier atomicité des assignations

## 📱 Tests WhatsApp (si activé)

### Configuration des Numéros de Test
1. Utiliser des numéros réels ou sandbox WhatsApp
2. Vérifier que les messages arrivent correctement
3. Tester les boutons de réponse (Accept/Reject)

### Messages à Vérifier
- 🔍 "Recherche de chauffeur" (client)
- 🚗 "Nouvelle course disponible" (chauffeurs)
- ✅ "Chauffeur trouvé" (client)
- ℹ️ "Course prise par autre chauffeur" (autres chauffeurs)

## 📈 Monitoring en Temps Réel

### Logs à Surveiller
```bash
# Suivre les logs en temps réel
tail -f logs/app.log | grep -E "(MATCHING|TIMEOUT|DRIVER_RESPONSE)"

# Ou utiliser l'API metrics
watch -n 5 'curl -s http://localhost:3000/api/health/metrics | jq'
```

### Base de Données
```sql
-- Voir les matchings actifs
SELECT * FROM MatchingMetrics WHERE finalStatus = 'ACTIVE';

-- Voir les notifications en cours
SELECT * FROM BookingNotification WHERE response IS NULL;

-- Statistiques temps réel
SELECT 
  COUNT(*) as total_bookings,
  AVG(timeToMatch) as avg_match_time,
  COUNT(CASE WHEN finalStatus = 'MATCHED' THEN 1 END) as successful_matches
FROM MatchingMetrics 
WHERE createdAt > NOW() - INTERVAL 1 HOUR;
```

## 🎯 Critères de Succès

### Performance
- [ ] Temps de matching < 30s en moyenne
- [ ] Taux de succès > 80%
- [ ] Zéro race condition non gérée

### Robustesse
- [ ] Système stable avec 10+ bookings simultanés
- [ ] Récupération automatique des erreurs
- [ ] Monitoring et alertes fonctionnels

### UX
- [ ] Notifications temps réel
- [ ] Messages clairs et en français
- [ ] Feedback utilisateur immédiat

---

🎉 **Votre système TICKET-007 est opérationnel !**

Pour des tests plus avancés, consultez les logs détaillés et utilisez les endpoints de monitoring intégrés.