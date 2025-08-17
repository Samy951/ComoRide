# TICKET-004 : Bot WhatsApp Core - Spécification Technique

## 📋 Vue d'Ensemble

**Objectif** : Développer un bot WhatsApp fonctionnel intégré au backend Como Ride existant, permettant aux clients de réserver des courses et consulter leur historique via une interface conversationnelle.

**Périmètre** : Intégration whatsapp-web.js, gestion sessions utilisateur, flows conversationnels, reconnexion intelligente, intégration API REST existante.

**Prérequis** : API REST fonctionnelle (TICKET-003), base Prisma Customer/Driver/Booking.

---

## 🏗️ Architecture Technique

### Structure du Code

```
src/bot/
├── index.ts                    # Client WhatsApp principal + événements
├── config/
│   ├── whatsapp.config.ts     # Configuration WhatsApp
│   └── session.config.ts      # Configuration sessions
├── handlers/
│   ├── message.handler.ts     # Routage messages entrants
│   ├── menu.handler.ts        # Menu principal + navigation
│   └── error.handler.ts       # Gestion erreurs bot
├── flows/
│   ├── booking.flow.ts        # Flow complet réservation
│   ├── history.flow.ts        # Consultation historique trajets
│   └── help.flow.ts           # Aide et support
├── states/
│   ├── session.manager.ts     # Gestionnaire sessions hybrides
│   ├── state.types.ts         # Types états conversation
│   └── timeout.manager.ts     # Gestion timeouts progressifs
├── services/
│   ├── whatsapp.service.ts    # Service communication WhatsApp
│   ├── reconnection.service.ts # Service reconnexion intelligente
│   └── notification.service.ts # Notifications proactives
└── utils/
    ├── message.formatter.ts   # Formatage messages
    ├── phone.utils.ts         # Utilitaires numéros téléphone
    └── validation.utils.ts    # Validation inputs utilisateur
```

### Architecture Session Hybride

**1. Session WhatsApp (Fichiers Locaux)**
- Chemin : `./sessions/whatsapp_session/`
- Contenu : Authentification WhatsApp, cookies, tokens
- Persistence : whatsapp-web.js intégré
- Backup automatique chaque 6h

**2. État Conversations (Base Prisma)**
```sql
-- Nouvelle table à ajouter au schema
model UserSession {
  id            String    @id @default(cuid())
  phoneNumber   String    @unique
  currentState  String    @default("MENU") 
  conversationData Json?  -- État booking en cours
  lastMessageAt DateTime  @default(now())
  timeoutCount  Int       @default(0)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@index([phoneNumber])
  @@index([lastMessageAt])
}
```

**3. Cache Mémoire (Runtime)**
- Structure : `Map<phoneNumber, ConversationState>`
- Synchronisation DB ↔ Cache toutes les 30s
- Purge automatique conversations inactives > 1h

---

## 🤖 Flows Conversationnels

### Menu Principal Como Ride

**Template Message d'Accueil :**
```
🚗 *Como Ride - Transport Sûr*

Bonjour {nom} ! 👋

Choisissez une option :
🔹 *1* - Nouvelle réservation  
🔹 *2* - Mes trajets récents
🔹 *3* - Aide & Contact

_Tapez le numéro de votre choix_

---
💡 *Nouveau chez Como Ride ?*
Tapez *AIDE* pour commencer
```

**États Disponibles :**
- `MENU` : Menu principal
- `BOOKING_START` : Début réservation
- `BOOKING_PICKUP` : Saisie adresse départ
- `BOOKING_DROP` : Saisie adresse arrivée  
- `BOOKING_TIME` : Choix horaire
- `BOOKING_CONFIRM` : Confirmation réservation
- `BOOKING_WAITING` : Attente chauffeur
- `HISTORY_VIEW` : Consultation historique
- `HELP_MODE` : Mode aide

### Flow Réservation (booking.flow.ts)

**1. Démarrage** (`BOOKING_START`)
```
🎯 *Nouvelle Réservation*

D'où partons-nous ?
📍 Envoyez votre adresse de départ

_Exemple : Moroni Centre, près du marché_

❌ Tapez 0 pour annuler
```

**2. Adresse Départ** (`BOOKING_PICKUP`)
- Validation adresse minimum 5 caractères
- Suggestion zones connues (Moroni, Mutsamudu, etc.)
- Sauvegarde état en DB

**3. Adresse Arrivée** (`BOOKING_DROP`)
```
📍 Départ : {pickup_address}

Où allons-nous ?
🎯 Envoyez votre destination

_Exemple : Aéroport Prince Said Ibrahim_
```

**4. Choix Horaire** (`BOOKING_TIME`)
```
🕐 Quand voulez-vous partir ?

*1* - Maintenant
*2* - Dans 30 minutes  
*3* - Dans 1 heure
*4* - Autre horaire (préciser)

⏰ Réservation jusqu'à 24h à l'avance
```

**5. Confirmation** (`BOOKING_CONFIRM`)
```
✅ *Résumé de votre réservation*

📍 **Départ :** {pickup}
🎯 **Arrivée :** {destination}  
🕐 **Horaire :** {datetime}
👥 **Passagers :** {count}

💰 **Tarif estimé :** {estimated_fare} KMF

*1* - Confirmer la réservation
*2* - Modifier les détails
*0* - Annuler

⚡ Confirmation en moins de 2 minutes
```

**6. Recherche Chauffeur** (`BOOKING_WAITING`)
```
🔍 *Recherche d'un chauffeur...*

⏱️ Temps estimé : 30-90 secondes
📱 Vous recevrez une notification dès qu'un chauffeur accepte

🚫 Tapez *ANNULER* pour annuler
```

### Flow Historique (history.flow.ts)

```
📚 *Vos trajets récents*

🚗 **{date}** - {pickup} → {destination}
   Chauffeur : {driver_name} ⭐ {rating}
   Tarif : {fare} KMF

🚗 **{date}** - {pickup} → {destination}  
   Chauffeur : {driver_name} ⭐ {rating}
   Tarif : {fare} KMF

*1* - Voir plus de trajets
*2* - Refaire une réservation identique
*0* - Retour menu principal
```

---

## ⏰ Gestion Timeouts et Reconnexion

### Timeouts Progressifs

**Niveaux de Timeout :**
1. **Inactivité 5min** : Rappel automatique
   ```
   👋 Toujours là ?
   Votre réservation est en attente...
   
   Tapez *CONTINUER* ou *MENU* pour le menu principal
   ```

2. **Inactivité 15min** : Sauvegarde + retour menu
   ```
   ⏰ Session expirée par inactivité
   
   Vos informations sont sauvegardées.
   Tapez *REPRENDRE* pour continuer ou un numéro pour le menu.
   ```

3. **Session 45min** : Reset complet
   - Suppression cache mémoire
   - Conservation historique DB uniquement

**Exceptions Timeout :**
- **Booking confirmé** : Pas de timeout jusqu'à attribution chauffeur
- **Attente chauffeur** : Timeout 10min puis annulation auto

### Reconnexion Intelligente

**Détection Déconnexion :**
```typescript
// whatsapp.service.ts
client.on('disconnected', async (reason) => {
  logger.warn('WhatsApp disconnected', { reason });
  await this.handleReconnection();
});
```

**Stratégie Reconnexion :**
1. **Sauvegarde états** : Persistence immédiate toutes sessions actives
2. **Tentative reconnexion** : 3 essais avec backoff (30s, 2min, 5min)
3. **Notification utilisateurs** : Message proactif après reconnexion
4. **Reprise conversations** : Restauration depuis DB

**Message de Reprise :**
```
🔄 *Connexion rétablie*

Voulez-vous continuer votre réservation ?
📍 {pickup} → {destination}

*1* - Continuer
*0* - Nouvelle réservation
```

---

## 🔌 Intégration API REST

### Mapping Services Existants

**Authentification :**
```typescript
// Mapping phoneNumber → Customer
const customer = await authService.authenticateByPhone(phoneNumber);
if (!customer) {
  // Création automatique nouveau client
  customer = await authService.createCustomer({ phoneNumber, name });
}
```

**Réservation :**
```typescript
// Appel service booking existant
const booking = await bookingService.createBooking({
  customerId: customer.id,
  pickupAddress,
  dropAddress,
  pickupTime,
  passengers: 1
});
```

**Historique :**
```typescript
const trips = await bookingService.getCustomerTrips(customer.id, { limit: 5 });
```

### Gestion Erreurs API

**Types d'Erreurs :**
1. **500 Server Error** : "Problème technique temporaire"
2. **Booking validation** : Messages personnalisés par champ
3. **No drivers available** : "Aucun chauffeur disponible actuellement"
4. **Rate limiting** : "Trop de demandes, veuillez patienter"

**Stratégie Retry :**
- 3 tentatives avec backoff exponentiel (1s, 3s, 9s)
- Fallback gracieux vers message d'erreur utilisateur
- Préservation état conversation pour retry manuel

---

## 🧪 Tests et Validation

### Mock WhatsApp pour Tests

**Structure Test :**
```typescript
// tests/bot/mock-whatsapp.ts
class MockWhatsAppClient {
  private messageHandlers: Map<string, Function> = new Map();
  
  async sendMessage(to: string, message: string) {
    // Simulation envoi
    return { success: true, messageId: 'mock_' + Date.now() };
  }
  
  simulateMessage(from: string, body: string) {
    // Simulation réception message
    this.emit('message', { from, body, timestamp: Date.now() });
  }
}
```

**Tests Flows Principaux :**
1. **Test Menu Navigation**
   - Envoi "1" → transition BOOKING_START
   - Envoi "2" → transition HISTORY_VIEW
   - Input invalide → message d'erreur + retour menu

2. **Test Flow Réservation Complet**
   - Séquence complète : menu → adresses → horaire → confirmation
   - Validation sauvegardes état à chaque étape
   - Test annulation à chaque étape

3. **Test Gestion Erreurs**
   - API 500 → message d'erreur + préservation état
   - Timeout session → message + retour menu
   - Reconnexion → reprise conversation

4. **Test Timeout Progressifs**
   - Simulation inactivité 5min → rappel
   - Simulation inactivité 15min → sauvegarde + menu
   - Validation purge sessions expirées

### Tests d'Intégration

**Configuration Test :**
```typescript
// Utilisation DB test séparée
const testDatabase = 'postgresql://test:test@localhost/como_ride_test';

beforeEach(async () => {
  await prisma.userSession.deleteMany();
  await prisma.customer.deleteMany();
  mockWhatsApp.reset();
});
```

**Scenarios Testés :**
- Création automatique Customer via bot
- Mapping conversation → API calls
- Persistence sessions entre redémarrages
- Gestion concurrence (2 utilisateurs simultanés)

---

## 🚀 Intégration Serveur Express

### Initialisation Bot

**server.ts - Ajouts :**
```typescript
import { WhatsAppBot } from './bot/index';

const startServer = async () => {
  // ... initialisation existante ...
  
  // Initialisation bot WhatsApp
  const whatsappBot = new WhatsAppBot();
  await whatsappBot.initialize();
  
  // Health check incluant WhatsApp
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      api: 'running',
      whatsapp: whatsappBot.isConnected() ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  });
  
  // Graceful shutdown incluant WhatsApp
  const gracefulShutdown = async () => {
    logger.info('Starting graceful shutdown...');
    
    await whatsappBot.disconnect();
    logger.info('WhatsApp bot disconnected');
    
    // ... reste shutdown existant ...
  };
};
```

### Variables d'Environnement

**Ajouts .env :**
```bash
# WhatsApp Bot Configuration
WHATSAPP_SESSION_PATH=./sessions/whatsapp_session
WHATSAPP_RECONNECT_ATTEMPTS=3
WHATSAPP_TIMEOUT_WARNING=300000  # 5min
WHATSAPP_TIMEOUT_RESET=900000    # 15min
WHATSAPP_SESSION_MAX=2700000     # 45min

# Bot Messages
BOT_WELCOME_MESSAGE="🚗 Como Ride - Transport Sûr"
BOT_SUPPORT_PHONE="+269XXXXXXXX"
```

### Logging WhatsApp

**Winston Configuration :**
```typescript
// Logs spécifiques bot
logger.info('WhatsApp message received', {
  from: message.from,
  messageType: message.type,
  sessionState: session.currentState,
  processingTime: Date.now() - startTime
});

logger.error('WhatsApp API call failed', {
  endpoint: '/api/v1/bookings',
  error: error.message,
  retryCount: retryAttempt,
  phoneNumber: phoneNumber.replace(/\d{4}$/, 'XXXX') // Masquage partiel
});
```

---

## 📦 Dépendances et Installation

### Nouvelles Dépendances

**Production :**
```json
{
  "whatsapp-web.js": "^1.23.0",
  "qrcode-terminal": "^0.12.0"
}
```

**Développement :**
```json
{
  "@types/qrcode-terminal": "^0.12.0"
}
```

### Script Installation

```bash
# Installation dépendances
npm install whatsapp-web.js qrcode-terminal
npm install --save-dev @types/qrcode-terminal

# Création répertoires sessions
mkdir -p sessions/whatsapp_session

# Migration base UserSession
npx prisma migrate dev --name add-user-session
```

---

## ✅ Critères d'Acceptation

### Fonctionnel
- [ ] Bot répond aux messages WhatsApp dans les 3 secondes
- [ ] Menu principal fonctionnel avec navigation par numéros
- [ ] Flow réservation complet : départ → arrivée → horaire → confirmation
- [ ] Consultation historique derniers trajets
- [ ] Création automatique Customer si n'existe pas
- [ ] Messages d'erreur en français comorien

### Technique
- [ ] Sessions persistées entre redémarrages serveur
- [ ] Reconnexion automatique après déconnexion WhatsApp
- [ ] Timeouts progressifs implémentés (5min, 15min, 45min)
- [ ] Intégration API REST sans modification des endpoints
- [ ] Gestion erreurs API avec retry automatique
- [ ] Logs Winston pour tous événements bot

### Tests
- [ ] 90%+ couverture code bot (flows + handlers)
- [ ] Tests mock WhatsApp fonctionnels
- [ ] Tests intégration avec API REST
- [ ] Tests scenarios timeout et reconnexion
- [ ] Tests gestion concurrence utilisateurs

### Performance
- [ ] Temps réponse < 3 secondes pour messages simples
- [ ] Support 50+ conversations simultanées
- [ ] Mémoire stable (pas de fuites sessions)
- [ ] Reconnexion < 30 secondes après déconnexion

---

## 🎯 Livrables

1. **Code Fonctionnel** : Architecture bot complète dans `src/bot/`
2. **Tests** : Suite tests unitaires + intégration 
3. **Migration DB** : Ajout table `UserSession`
4. **Documentation** : README setup WhatsApp + flows
5. **Configuration** : Variables environnement + health checks

**Estimation** : 8-10h développement + 3h tests et documentation

---

## 🔄 Évolutions Futures (Hors Scope)

- Envoi images (plan trajets, QR codes paiement)
- Commandes vocales (notes audio réservation)  
- Groupes WhatsApp (notifications chauffeurs)
- Webhook WhatsApp Business API (alternative à web.js)
- Chatbot IA pour questions complexes