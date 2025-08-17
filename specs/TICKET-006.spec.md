# TICKET-006 : Interface Chauffeur Bot

## Vue d'ensemble

Extension du bot WhatsApp existant pour inclure une interface chauffeur complète permettant aux chauffeurs de gérer leur disponibilité, recevoir des notifications de courses et gérer leurs trajets via WhatsApp.

## Objectifs

### Fonctionnels
- Interface chauffeur unifiée dans le bot WhatsApp
- Gestion de disponibilité simple (Disponible/Occupé)
- Réception notifications nouvelles courses
- Acceptation/refus courses avec réponses simples (OUI/NON)
- Consultation statut courses en cours et terminées
- Menu hybride : chauffeur peut aussi utiliser mode client

### Techniques
- Extension architecture bot existante
- Réutilisation système d'états ConversationState
- Intégration avec AuthService pour détection type utilisateur
- Service notifications broadcast pour courses disponibles
- Persistance dans UserSession existant

## Architecture

### Nouveaux États de Conversation

```typescript
// Ajouts à ConversationState enum
DRIVER_MENU = 'DRIVER_MENU'                    // Menu principal chauffeur
DRIVER_AVAILABILITY = 'DRIVER_AVAILABILITY'    // Gestion disponibilité
DRIVER_BOOKING_NOTIFY = 'DRIVER_BOOKING_NOTIFY' // Notification nouvelle course
DRIVER_BOOKING_ACCEPT = 'DRIVER_BOOKING_ACCEPT' // Processus acceptation
DRIVER_TRIP_STATUS = 'DRIVER_TRIP_STATUS'      // Consultation courses
```

### Structure des Données

```typescript
// Extension ConversationData pour chauffeurs
interface DriverConversationData extends ConversationData {
  isDriverMode?: boolean;
  currentBookingNotification?: string; // ID de la booking notifiée
  bookingNotificationTimeout?: Date;   // Timeout pour acceptation
  availabilityToggleCount?: number;    // Compteur toggles dans session
}
```

## Spécifications Détaillées

### 1. Détection et Routage Utilisateur

#### Modification MessageHandler.handleMessage()
```typescript
// Logique de détection
1. Récupérer phoneNumber du message
2. Appeler AuthService.findUserByPhone(phoneNumber)
3. Si user.type === 'driver' : 
   - Vérifier si commande client (ex: "réserver")
   - Sinon router vers DriverHandler
4. Si user.type === 'customer' : router vers flux client existant
5. Si user === null : traiter comme nouveau client
```

#### Nouveau DriverHandler
```typescript
export class DriverHandler {
  async handleDriverMessage(phoneNumber: string, message: string, state: ConversationState): Promise<void>
  async routeDriverMessage(phoneNumber: string, message: string, state: ConversationState): Promise<void>
  async handleDriverMenuSelection(phoneNumber: string, input: string): Promise<void>
  async switchToClientMode(phoneNumber: string): Promise<void>
}
```

### 2. Flow Chauffeur Principal

#### DriverFlow.handleDriverMenu()
```typescript
// Menu principal chauffeur
🚗 *MENU CHAUFFEUR*

Salut [NOM] ! Que veux-tu faire ?

*1* - 🟢 Je suis disponible
*2* - 🔴 Je suis occupé  
*3* - 📋 Mes courses
*4* - 👤 Mode client (réserver)
*5* - ❓ Aide chauffeur

*0* - 🔄 Actualiser

Statut actuel: [DISPONIBLE/OCCUPÉ]
```

#### DriverFlow.handleAvailabilityToggle()
```typescript
// Gestion disponibilité
Si option 1 (Disponible):
  - Mettre Driver.isAvailable = true, isOnline = true
  - Message: "✅ Vous êtes maintenant DISPONIBLE pour recevoir des courses"
  - Retour menu après 2s

Si option 2 (Occupé):
  - Mettre Driver.isAvailable = false  
  - Message: "🔴 Vous êtes maintenant OCCUPÉ. Vous ne recevrez plus de notifications"
  - Retour menu après 2s
```

#### DriverFlow.handleTripStatus()
```typescript
// Consultation courses
📋 *MES COURSES*

🔄 **En cours** (2)
- Moroni → Aéroport (14h30)
- Itsandra → Centre (15h45)

✅ **Terminées aujourd'hui** (5)
- Mutsamudu → Domoni (12h15) - 2500 KMF ⭐4.8
- Sima → Ouani (10h30) - 3000 KMF ⭐5.0

*1* - Voir détails course en cours
*2* - Historique complet
*0* - Retour menu
```

### 3. Système de Notifications

#### DriverNotificationService
```typescript
export class DriverNotificationService {
  // Notification nouvelle course disponible
  async notifyNewBooking(bookingId: string, driverIds: string[]): Promise<void>
  
  // Broadcast à tous chauffeurs disponibles dans zone
  async broadcastToAvailableDrivers(booking: Booking): Promise<void>
  
  // Timeout notification (30 secondes)
  async handleBookingTimeout(bookingId: string, driverId: string): Promise<void>
  
  // Confirmation acceptation course
  async confirmBookingAcceptance(bookingId: string, driverId: string): Promise<void>
}
```

#### Format Notification Course
```typescript
🔔 *NOUVELLE COURSE DISPONIBLE*

📍 **Départ**: [pickupAddress]
🎯 **Arrivée**: [dropAddress]  
⏰ **Heure**: [pickupTime]
👥 **Passagers**: [passengers]
💰 **Tarif estimé**: [estimatedFare] KMF

🚗 Réponds rapidement :
*OUI* - Accepter la course
*NON* - Refuser

⏱️ Tu as 30 secondes pour répondre
```

#### Logique Broadcast
```typescript
1. Récupérer booking depuis DB
2. Identifier zone de pickup
3. Trouver chauffeurs: isAvailable=true, isVerified=true, zone overlap
4. Envoyer notification simultanément (Promise.all)
5. Premier à répondre OUI gagne la course
6. Notifier autres que course est prise
7. Si aucune réponse après 30s: élargir zone recherche
```

### 4. Acceptation/Refus Courses

#### DriverFlow.handleBookingResponse()
```typescript
// État DRIVER_BOOKING_ACCEPT
Si message === "OUI" ou "1":
  - Vérifier booking encore disponible
  - Assigner booking au chauffeur
  - Confirmer: "✅ Course acceptée ! Client notifié. Détails en cours..."
  - Envoyer détails complets course
  - Notifier client que chauffeur assigné

Si message === "NON" ou "2":  
  - Marquer chauffeur comme ayant refusé
  - Confirmer: "❌ Course refusée"
  - Retour menu chauffeur
  - Continuer broadcast autres chauffeurs

Si timeout (30s):
  - Message: "⏰ Délai dépassé, course proposée à d'autres chauffeurs"
  - Retour menu
```

#### Détails Course Acceptée
```typescript
✅ *COURSE CONFIRMÉE*

👤 **Client**: [customerName]
📞 **Téléphone**: [customerPhone]
📍 **Récupération**: [pickupAddress]
🎯 **Destination**: [dropAddress]
⏰ **Heure prévue**: [pickupTime]
💰 **Tarif**: [finalFare] KMF

📍 Localisation exacte pickup:
[coordonnées GPS si disponibles]

*1* - Contacter client
*2* - Course terminée
*3* - Problème/Annulation
*0* - Retour menu
```

### 5. Mode Hybride Client

#### Basculement vers Mode Client
```typescript
// Depuis menu chauffeur option 4
async switchToClientMode(phoneNumber: string): Promise<void> {
  // Marquer temporairement en mode client
  await sessionManager.setConversationData(phoneNumber, {
    isDriverMode: false,
    temporaryClientMode: true
  });
  
  // Afficher menu client standard
  await menuHandler.showMainMenu(phoneNumber, 
    "🔄 *MODE CLIENT ACTIVÉ*\n\nVous pouvez maintenant réserver comme un client :");
}

// Retour automatique mode chauffeur après booking ou timeout
```

### 6. Intégrations

#### Modification BookingService
```typescript
// Ajouter dans BookingService.createBooking()
async createBooking(data: CreateBookingRequest): Promise<Booking> {
  // ... logique existante ...
  
  // Après création booking
  if (booking.status === 'PENDING') {
    await driverNotificationService.broadcastToAvailableDrivers(booking);
  }
  
  return booking;
}
```

#### Modification MenuHandler
```typescript
// Dans showMainMenu(), détecter si chauffeur
async showMainMenu(phoneNumber: string, customMessage?: string): Promise<void> {
  const user = await AuthService.findUserByPhone(phoneNumber);
  
  if (user?.type === 'driver') {
    // Vérifier si mode client temporaire
    const session = await sessionManager.getSession(phoneNumber);
    if (!session.conversationData.temporaryClientMode) {
      return await driverFlow.handleDriverMenu(phoneNumber);
    }
  }
  
  // Logique client existante...
}
```

## Messages et Interface

### Messages d'Erreur Chauffeur
```typescript
// Chauffeur non vérifié
❌ *ACCÈS REFUSÉ*
Votre compte chauffeur n'est pas encore vérifié.
Contactez l'administration : +269 XXX XXXX

// Tentative accepter course déjà prise
⚠️ *COURSE DÉJÀ ASSIGNÉE*
Cette course a été acceptée par un autre chauffeur.
Retour au menu...

// Erreur technique
🔧 *ERREUR TECHNIQUE*
Problème temporaire. Réessayez dans quelques instants.
Support : +269 XXX XXXX
```

### Commandes Globales Chauffeur
```typescript
// Commandes acceptées depuis n'importe quel état chauffeur
"DISPONIBLE" -> Activer disponibilité directement
"OCCUPÉ" -> Désactiver disponibilité directement  
"COURSES" -> Voir statut courses
"CLIENT" -> Basculer mode client
"MENU" -> Retour menu chauffeur
```

## Tests et Critères d'Acceptation

### Tests Unitaires
- ✅ AuthService détecte correctement type utilisateur
- ✅ DriverFlow gère tous les états de conversation
- ✅ DriverNotificationService envoie notifications
- ✅ Broadcast sélectionne chauffeurs appropriés
- ✅ Timeout course fonctionne (30s)
- ✅ Basculement mode client/chauffeur

### Tests d'Intégration
- ✅ Cycle complet: notification → acceptation → course
- ✅ Gestion conflits (plusieurs chauffeurs acceptent)
- ✅ Persistance état après reconnection WhatsApp
- ✅ Synchronisation base de données
- ✅ Interface admin TICKET-005 voit activité chauffeurs

### Tests End-to-End
- ✅ Chauffeur reçoit notification course client
- ✅ Client voit chauffeur assigné après acceptation
- ✅ Chauffeur peut consulter historique courses
- ✅ Mode hybride: chauffeur peut réserver course
- ✅ Performance: notification < 5s, acceptation < 2s

### Critères d'Acceptation Métier

#### Fonctionnels
1. ✅ Chauffeur peut activer/désactiver disponibilité
2. ✅ Notification course reçue en < 10 secondes
3. ✅ Acceptation course en 2 clics maximum (OUI/NON)
4. ✅ Consultation courses terminées disponible
5. ✅ Mode client accessible pour chauffeurs

#### Techniques  
1. ✅ Réutilise 90%+ de l'architecture bot existante
2. ✅ Pas de régression fonctionnalités client
3. ✅ Performance: 0 impact sur temps réponse client
4. ✅ Logs complets activité chauffeurs
5. ✅ Compatible interface admin existante

#### UX/UI
1. ✅ Messages français adapté contexte Comores
2. ✅ Interface simple: maximum 3 options par menu
3. ✅ Confirmation claire pour chaque action
4. ✅ Gestion gracieuse des erreurs
5. ✅ Cohérence avec expérience client existante

## Métriques de Succès

### Adoption
- 80%+ chauffeurs utilisent interface bot vs appels
- Temps moyen réponse notification < 15 secondes
- 90%+ courses acceptées via bot (vs autres canaux)

### Performance
- Disponibilité service chauffeur > 99.5%
- Latence notification course < 5 secondes
- Zéro perte de notification par bug technique

### Satisfaction
- Score satisfaction chauffeurs > 4.5/5
- Réduction 50% appels support chauffeurs
- 95%+ courses terminées sans problème technique