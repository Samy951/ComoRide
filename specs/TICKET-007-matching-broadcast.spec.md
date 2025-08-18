# TICKET-007 : Système Matching & Broadcast Robuste

## 📋 Vue d'ensemble

**Objectif** : Optimiser et fiabiliser le système de matching existant (TICKET-006) avec focus sur la robustesse production et la gestion des edge cases.

**Priorité** : Haute
**Estimation** : 2-3 jours
**Dépendances** : TICKET-006 (DriverNotificationService existant)

## 🎯 Objectifs fonctionnels

### Problèmes actuels à résoudre
- ❌ Broadcast limité à 5 chauffeurs (doit être TOUS)
- ❌ Race conditions lors d'acceptations simultanées
- ❌ Pas de tracking précis des notifications envoyées
- ❌ Timeout fixe sans escalade intelligente
- ❌ Pas d'alertes admin pour courses abandonnées
- ❌ Notifications perdants basiques

### Nouveaux comportements requis
- ✅ Broadcast à TOUS les chauffeurs actifs
- ✅ Verrouillage optimiste pour éviter double attribution
- ✅ Timeout intelligent : 30s/chauffeur + 5min global
- ✅ Tracking complet des notifications
- ✅ Métriques temps réel
- ✅ Alertes admin automatiques

## 🏗️ Architecture technique

### 1. Base de données

#### 1.1 Modifications table Booking
```sql
ALTER TABLE "Booking" ADD COLUMN "version" INTEGER DEFAULT 1;
CREATE INDEX "Booking_version_idx" ON "Booking"("version");
```

#### 1.2 Nouvelle table BookingNotification
```sql
CREATE TABLE "BookingNotification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "response" TEXT, -- ACCEPTED | REJECTED | TIMEOUT
  "notificationMethod" TEXT DEFAULT 'WHATSAPP',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "BookingNotification_bookingId_fkey" 
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE,
  CONSTRAINT "BookingNotification_driverId_fkey" 
    FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "BookingNotification_bookingId_driverId_key" 
  ON "BookingNotification"("bookingId", "driverId");
CREATE INDEX "BookingNotification_sentAt_idx" ON "BookingNotification"("sentAt");
CREATE INDEX "BookingNotification_response_idx" ON "BookingNotification"("response");
```

#### 1.3 Nouvelle table MatchingMetrics
```sql
CREATE TABLE "MatchingMetrics" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "totalDriversNotified" INTEGER NOT NULL,
  "totalDriversResponded" INTEGER DEFAULT 0,
  "acceptedAt" TIMESTAMP(3),
  "timeToMatch" INTEGER, -- en secondes
  "finalStatus" TEXT, -- MATCHED | TIMEOUT | CANCELLED
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "MatchingMetrics_bookingId_fkey" 
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "MatchingMetrics_bookingId_key" ON "MatchingMetrics"("bookingId");
```

### 2. MatchingService

#### 2.1 Interface principale
```typescript
interface MatchingService {
  // Méthode principale de matching
  startMatching(bookingId: string, options?: MatchingOptions): Promise<MatchingResult>
  
  // Gestion des réponses chauffeurs
  handleDriverResponse(bookingId: string, driverId: string, response: DriverResponse): Promise<ResponseResult>
  
  // Gestion des timeouts
  handleBookingTimeout(bookingId: string): Promise<void>
  handleDriverTimeout(bookingId: string, driverId: string): Promise<void>
  
  // Annulation pendant matching
  cancelMatching(bookingId: string, reason: string): Promise<void>
  
  // Métriques
  getMatchingStats(timeframe?: TimeFrame): Promise<MatchingStats>
}
```

#### 2.2 Types de données
```typescript
interface MatchingOptions {
  maxDistance?: number; // Par défaut: illimité
  excludeDriverIds?: string[];
  priorityMode?: 'DISTANCE' | 'RECENT_ACTIVITY'; // Par défaut: RECENT_ACTIVITY
}

interface MatchingResult {
  success: boolean;
  driversNotified: number;
  driverIds: string[];
  errors: string[];
  matchingMetricsId: string;
}

interface DriverResponse {
  type: 'ACCEPT' | 'REJECT';
  timestamp: Date;
  responseTime: number; // en millisecondes
}

interface ResponseResult {
  success: boolean;
  action: 'ASSIGNED' | 'REJECTED' | 'ALREADY_TAKEN' | 'BOOKING_CANCELLED';
  message: string;
}
```

#### 2.3 Logique de matching
```typescript
class MatchingService {
  async startMatching(bookingId: string, options: MatchingOptions = {}): Promise<MatchingResult> {
    // 1. Vérifier que booking existe et est PENDING
    // 2. Créer MatchingMetrics
    // 3. Trouver TOUS les chauffeurs disponibles
    // 4. Créer BookingNotification pour chaque chauffeur
    // 5. Broadcaster en parallèle via DriverNotificationService
    // 6. Démarrer timeout global (5 minutes)
    // 7. Démarrer timeouts individuels (30s par chauffeur)
    // 8. Notifier client "Recherche en cours..."
    // 9. Retourner résultat
  }

  async handleDriverResponse(bookingId: string, driverId: string, response: DriverResponse): Promise<ResponseResult> {
    // 1. Vérifier que notification existe
    // 2. Marquer notification comme répondue
    // 3. Si ACCEPT → tenter assignation atomique
    // 4. Si REJECT → juste logger
    // 5. Annuler timeout individuel du chauffeur
    // 6. Mettre à jour métriques
    // 7. Retourner résultat
  }

  private async attemptBookingAssignment(bookingId: string, driverId: string): Promise<boolean> {
    // VERROUILLAGE OPTIMISTE avec Prisma transaction
    return await prisma.$transaction(async (tx) => {
      // 1. SELECT booking WHERE id = bookingId AND status = PENDING FOR UPDATE
      // 2. Vérifier version (éviter race conditions)
      // 3. Si OK → UPDATE booking SET driverId, status=ACCEPTED, version++
      // 4. Si KO → return false
      // 5. Notifier autres chauffeurs "Course prise"
      // 6. Annuler tous les timeouts
      // 7. Notifier client succès
      // 8. Mettre à jour métriques (acceptedAt, timeToMatch)
      // 9. return true
    });
  }
}
```

### 3. Optimisations DriverNotificationService

#### 3.1 Modifications nécessaires
```typescript
class DriverNotificationService {
  async broadcastToAvailableDrivers(
    booking: Booking, 
    options: DriverNotificationOptions = {}
  ): Promise<BroadcastResult> {
    // CHANGEMENT: Supprimer maxDrivers par défaut
    // CHANGEMENT: Broadcaster à TOUS les chauffeurs disponibles
    // CHANGEMENT: Ordre par lastSeenAt DESC (plus récents d'abord)
    // NOUVEAU: Créer BookingNotification pour tracking
    // NOUVEAU: Retourner IDs précis des chauffeurs notifiés
  }

  async notifyOtherDriversBookingTaken(bookingId: string, acceptingDriverId: string): Promise<void> {
    // AMÉLIORATION: Utiliser BookingNotification pour savoir QUI notifier
    // Au lieu de notifier tous les chauffeurs disponibles
    // Notifier seulement ceux qui ont reçu la notification initiale
  }
}
```

### 4. Système de timeout intelligent

#### 4.1 Timeouts à deux niveaux
```typescript
interface TimeoutManager {
  // Timeout individuel chauffeur (30s)
  setDriverTimeout(bookingId: string, driverId: string): void;
  clearDriverTimeout(bookingId: string, driverId: string): void;
  
  // Timeout global booking (5min)
  setBookingTimeout(bookingId: string): void;
  clearBookingTimeout(bookingId: string): void;
  
  // Nettoyage automatique
  cleanup(): void;
}

class TimeoutManager {
  private driverTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private bookingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  setDriverTimeout(bookingId: string, driverId: string): void {
    const timeoutKey = `${bookingId}:${driverId}`;
    const timeout = setTimeout(async () => {
      await this.handleDriverTimeout(bookingId, driverId);
    }, 30000); // 30 secondes
    
    this.driverTimeouts.set(timeoutKey, timeout);
  }

  setBookingTimeout(bookingId: string): void {
    const timeout = setTimeout(async () => {
      await this.handleBookingTimeout(bookingId);
    }, 300000); // 5 minutes
    
    this.bookingTimeouts.set(bookingId, timeout);
  }

  private async handleDriverTimeout(bookingId: string, driverId: string): Promise<void> {
    // 1. Marquer BookingNotification comme TIMEOUT
    // 2. Logger timeout chauffeur
    // 3. Vérifier si c'était le dernier chauffeur
    // 4. Si oui → déclencher escalade
  }

  private async handleBookingTimeout(bookingId: string): Promise<void> {
    // 1. Vérifier si booking toujours PENDING
    // 2. Marquer MatchingMetrics comme TIMEOUT
    // 3. Notifier client "Aucun chauffeur disponible"
    // 4. ALERTER ADMIN via WhatsApp
    // 5. Proposer au client de réessayer plus tard
  }
}
```

### 5. Admin Alert Service

#### 5.1 Interface et fonctionnalités
```typescript
interface AdminAlertService {
  alertBookingTimeout(bookingId: string, customerInfo: CustomerInfo): Promise<void>;
  alertSystemError(error: SystemError): Promise<void>;
  alertLowDriverAvailability(zone: string, availableCount: number): Promise<void>;
  sendDailyMetricsReport(): Promise<void>;
}

interface CustomerInfo {
  name: string;
  phoneNumber: string;
  pickupAddress: string;
  dropAddress: string;
  pickupTime: Date;
}

interface SystemError {
  type: 'MATCHING_FAILURE' | 'DATABASE_ERROR' | 'NOTIFICATION_FAILURE';
  message: string;
  details?: any;
  timestamp: Date;
}
```

#### 5.2 Messages WhatsApp admin
```typescript
// Exemple message timeout
const timeoutMessage = `🚨 *ALERTE ADMIN*

❌ Aucun chauffeur trouvé après 5 minutes

📋 **Détails course:**
👤 Client: ${customerInfo.name}
📞 Téléphone: ${customerInfo.phoneNumber}
📍 Départ: ${customerInfo.pickupAddress}
🎯 Arrivée: ${customerInfo.dropAddress}
⏰ Heure prévue: ${customerInfo.pickupTime}

🔍 **Actions suggérées:**
- Contacter client pour proposer horaire alternatif
- Vérifier disponibilité chauffeurs
- Analyser demande dans zone

ID Course: ${bookingId}`;
```

### 6. Metrics Service

#### 6.1 Métriques à tracker
```typescript
interface MetricsService {
  // Métriques en temps réel
  getActiveMatchings(): Promise<number>;
  getAverageMatchingTime(timeframe: TimeFrame): Promise<number>;
  getAcceptanceRate(timeframe: TimeFrame): Promise<number>;
  getTimeoutRate(timeframe: TimeFrame): Promise<number>;
  
  // Métriques par zone/heure
  getMetricsByZone(zone: string, timeframe: TimeFrame): Promise<ZoneMetrics>;
  getMetricsByHour(hour: number, timeframe: TimeFrame): Promise<HourMetrics>;
  
  // Performances chauffeurs
  getDriverResponseStats(driverId: string, timeframe: TimeFrame): Promise<DriverStats>;
  
  // Rapports
  generateDailyReport(date: Date): Promise<DailyReport>;
  generateWeeklyReport(startDate: Date): Promise<WeeklyReport>;
}

interface ZoneMetrics {
  totalBookings: number;
  successfulMatches: number;
  averageMatchingTime: number;
  timeoutRate: number;
  peakHours: number[];
}

interface DriverStats {
  notificationsReceived: number;
  responsesGiven: number;
  acceptanceRate: number;
  averageResponseTime: number;
  timeoutCount: number;
}
```

### 7. Gestion des notifications client

#### 7.1 Messages client temps réel
```typescript
interface ClientNotificationService {
  notifySearchStarted(customerPhone: string, driversCount: number): Promise<void>;
  notifyDriverFound(customerPhone: string, driverInfo: DriverInfo): Promise<void>;
  notifySearchFailed(customerPhone: string, reason: string): Promise<void>;
  notifySearchProgress(customerPhone: string, status: SearchStatus): Promise<void>;
}

// Messages exemples
const searchStartedMessage = `🔍 *RECHERCHE DE CHAUFFEUR*

Nous recherchons un chauffeur pour votre course...
${driversCount} chauffeurs notifiés

⏱️ Nous vous tiendrons informé dans les 5 minutes maximum.`;

const driverFoundMessage = `✅ *CHAUFFEUR TROUVÉ !*

🚗 **Chauffeur:** ${driverInfo.name}
📞 **Contact:** ${driverInfo.phoneNumber}
⭐ **Note:** ${driverInfo.rating}/5
🚗 **Véhicule:** ${driverInfo.vehicleType} - ${driverInfo.vehiclePlate}

Votre chauffeur vous contactera sous peu !`;

const searchFailedMessage = `❌ *AUCUN CHAUFFEUR DISPONIBLE*

Malheureusement, aucun chauffeur n'est disponible actuellement pour votre course.

🔄 **Options:**
*1* - Réessayer maintenant
*2* - Programmer plus tard  
*3* - Modifier l'horaire

Nos équipes ont été alertées.`;
```

## 📊 Métriques et monitoring

### 1. Logs structurés
```typescript
// Exemples de logs avec Winston
logger.info('Matching started', {
  bookingId,
  driversNotified: result.driversNotified,
  searchRadius: options.maxDistance,
  timestamp: new Date().toISOString()
});

logger.warn('Driver timeout', {
  bookingId,
  driverId,
  responseTime: 30000,
  totalTimeouts: timeoutCount,
  timestamp: new Date().toISOString()
});

logger.error('Race condition detected', {
  bookingId,
  driverId,
  bookingStatus: 'ALREADY_ACCEPTED',
  timestamp: new Date().toISOString()
});
```

### 2. Health checks
```typescript
interface MatchingHealthService {
  checkMatchingSystemHealth(): Promise<HealthStatus>;
  checkDatabaseConnectivity(): Promise<boolean>;
  checkWhatsAppServiceHealth(): Promise<boolean>;
  checkActiveTimeouts(): Promise<TimeoutHealth>;
}

interface HealthStatus {
  overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  components: {
    database: ComponentHealth;
    whatsapp: ComponentHealth;
    timeouts: ComponentHealth;
    matching: ComponentHealth;
  };
  metrics: {
    activeMatchings: number;
    avgResponseTime: number;
    errorRate: number;
  };
}
```

## 🧪 Tests et validation

### 1. Tests unitaires requis

#### 1.1 MatchingService
```typescript
describe('MatchingService', () => {
  test('should notify all available drivers', async () => {
    // Mock 10 chauffeurs disponibles
    // Vérifier que les 10 reçoivent notification
  });

  test('should handle race condition correctly', async () => {
    // Simuler 2 chauffeurs acceptant simultanément
    // Vérifier qu'un seul est assigné
    // Vérifier que l'autre reçoit "Course déjà prise"
  });

  test('should timeout after 5 minutes', async () => {
    // Mock aucune réponse chauffeur
    // Vérifier timeout booking après 5min
    // Vérifier alerte admin envoyée
  });

  test('should track all notifications correctly', async () => {
    // Vérifier BookingNotification créées
    // Vérifier métriques mises à jour
  });
});
```

#### 1.2 Race Conditions
```typescript
describe('Race Conditions', () => {
  test('concurrent driver acceptances', async () => {
    // Simuler 3 chauffeurs acceptant en même temps
    // Vérifier verrouillage optimiste
    // Vérifier qu'un seul booking.driverId assigné
  });

  test('client cancellation during matching', async () => {
    // Client annule pendant broadcast
    // Vérifier que tous timeouts sont annulés
    // Vérifier que chauffeurs sont notifiés d'annulation
  });
});
```

#### 1.3 Timeouts
```typescript
describe('Timeout Management', () => {
  test('individual driver timeouts', async () => {
    // Mock chauffeur qui ne répond pas en 30s
    // Vérifier BookingNotification marked TIMEOUT
    // Vérifier métriques mises à jour
  });

  test('global booking timeout with admin alert', async () => {
    // Mock aucune réponse après 5min
    // Vérifier alerte admin envoyée
    // Vérifier client notifié
  });
});
```

### 2. Tests d'intégration

#### 2.1 Workflow complet
```typescript
describe('Complete Matching Workflow', () => {
  test('successful matching end-to-end', async () => {
    // 1. Créer booking
    // 2. Démarrer matching
    // 3. Simuler réponse chauffeur
    // 4. Vérifier assignation
    // 5. Vérifier notifications
    // 6. Vérifier métriques
  });

  test('no drivers available scenario', async () => {
    // Aucun chauffeur disponible
    // Vérifier timeout et alerte admin
  });
});
```

#### 2.2 Tests de charge
```typescript
describe('Load Testing', () => {
  test('handle 50 concurrent bookings', async () => {
    // Créer 50 bookings simultanés
    // Vérifier performance < 3s par booking
    // Vérifier aucune race condition
  });

  test('handle 100 drivers notification', async () => {
    // Mock 100 chauffeurs disponibles
    // Vérifier broadcast en < 5s
    // Vérifier tracking correct
  });
});
```

## ✅ Critères d'acceptation

### 1. Fonctionnels
- [ ] **Broadcast universel** : TOUS les chauffeurs disponibles sont notifiés
- [ ] **Zéro race condition** : Impossible d'assigner 2 chauffeurs à 1 course
- [ ] **Timeout intelligent** : 30s/chauffeur + 5min global + alerte admin
- [ ] **Notifications robustes** : Client informé à chaque étape
- [ ] **Tracking complet** : Toutes notifications trackées en DB
- [ ] **Métriques temps réel** : Dashboard admin avec stats

### 2. Techniques
- [ ] **Performance** : Broadcast à 100 chauffeurs en < 5s
- [ ] **Concurrence** : Support 50 bookings simultanés
- [ ] **Atomicité** : Toutes opérations critiques en transaction
- [ ] **Logs complets** : Debugging facilité en production
- [ ] **Tests coverage** : > 90% sur code critique
- [ ] **Zero downtime** : Migration DB sans interruption

### 3. Production
- [ ] **Monitoring** : Alertes automatiques si dysfonctionnement
- [ ] **Rollback** : Possibilité retour rapide version précédente
- [ ] **Health checks** : Vérification système toutes les minutes
- [ ] **Documentation** : Guide troubleshooting pour ops
- [ ] **Métriques SLA** : < 3s temps de matching moyen
- [ ] **Admin dashboard** : Vue temps réel des matchings actifs

## 🚀 Plan de déploiement

### 1. Phase 1 : Préparation DB
- Migration BookingNotification + MatchingMetrics
- Index performance
- Backup complet avant migration

### 2. Phase 2 : Déploiement services
- MatchingService + TimeoutManager
- AdminAlertService + MetricsService
- Modification DriverNotificationService

### 3. Phase 3 : Intégration
- BookingService utilise MatchingService
- DriverFlow utilise gestion atomique
- Tests production avec mode debug

### 4. Phase 4 : Monitoring
- Métriques dashboard admin
- Alertes configurées
- Documentation ops finalisée

## 📚 Documentation requise

### 1. Technique
- API documentation MatchingService
- Schema base de données mis à jour
- Guide troubleshooting production
- Métriques et alertes reference

### 2. Opérationnelle
- Procédures incident matching
- Guide monitoring dashboard
- FAQ erreurs courantes
- Contacts escalade

---

**Spec validée le** : _À compléter_
**Développeur assigné** : _À compléter_
**Date de livraison prévue** : _À compléter_