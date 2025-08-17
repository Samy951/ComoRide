# Database Architecture - Como Ride

## Overview

Como Ride utilise PostgreSQL avec Prisma ORM pour gérer la persistance des données. Le modèle de données est conçu pour supporter une plateforme de VTC adaptée aux spécificités des Comores.

## Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Customer     │────▶│     Booking     │◀────│     Driver      │
│                 │ 1:N │                 │ N:1 │                 │
│ - id            │     │ - id            │     │ - id            │
│ - phoneNumber   │     │ - customerId    │     │ - phoneNumber   │
│ - name          │     │ - driverId      │     │ - name          │
│ - rating        │     │ - pickupAddress │     │ - licenseNumber │
│ - createdAt     │     │ - dropAddress   │     │ - vehicleType   │
│ - updatedAt     │     │ - pickupLat     │     │ - vehiclePlate  │
└─────────────────┘     │ - pickupLng     │     │ - rating        │
                        │ - dropLat       │     │ - isAvailable   │
                        │ - dropLng       │     │ - isOnline      │
                        │ - pickupTime    │     │ - isVerified    │
                        │ - passengers    │     │ - zones[]       │
                        │ - status        │     │ - currentLat    │
                        │ - notes         │     │ - currentLng    │
                        │ - cancellation  │     │ - lastSeenAt    │
                        │   Reason        │     │ - createdAt     │
                        │ - estimatedFare │     │ - updatedAt     │
                        │ - createdAt     │     └─────────────────┘
                        │ - updatedAt     │
                        └─────────────────┘
                                │
                                │ 1:1
                                ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │      Trip       │────▶│  Transaction    │
                        │                 │ 1:1 │                 │
                        │ - id            │     │ - id            │
                        │ - bookingId     │     │ - tripId        │
                        │ - customerId    │     │ - amount        │
                        │ - driverId      │     │ - paymentMethod │
                        │ - startTime     │     │ - status        │
                        │ - endTime       │     │ - reference     │
                        │ - fare          │     │ - metadata      │
                        │ - distance      │     │ - createdAt     │
                        │ - paymentMethod │     │ - updatedAt     │
                        │ - paymentStatus │     └─────────────────┘
                        │ - customerRating│
                        │ - driverRating  │
                        │ - createdAt     │
                        │ - updatedAt     │
                        └─────────────────┘
```

## Core Models

### Customer
Représente les clients utilisant la plateforme via WhatsApp.

**Champs clés :**
- `phoneNumber` : Numéro WhatsApp au format +269XXXXXXX (unique)
- `rating` : Note moyenne basée sur les évaluations chauffeurs (défaut 5.0)

**Indexes :**
- Unique sur `phoneNumber` pour recherche rapide
- Index sur `phoneNumber` pour requêtes fréquentes

### Driver
Représente les chauffeurs partenaires vérifiés.

**Champs spécifiques :**
- `zones[]` : Array des zones de service (ex: ['Moroni', 'Iconi'])
- `isOnline` : Statut temps réel de connexion
- `isAvailable` : Disponibilité pour nouvelles courses
- `isVerified` : Statut de vérification (permis, véhicule)
- `currentLat/Lng` : Position GPS actuelle
- `lastSeenAt` : Dernière activité (pour déconnexion auto)

**Indexes :**
- Unique sur `phoneNumber` et `licenseNumber`
- Composite sur `(isAvailable, isVerified)` pour matching
- Index sur `isOnline` pour requêtes temps réel

### Booking
Représente une demande de course du client.

**Workflow des statuts :**
```
PENDING → ACCEPTED → COMPLETED
    ↓         ↓
CANCELLED  REJECTED
```

**Champs GPS :**
- `pickupLat/Lng` : Coordonnées point de départ
- `dropLat/Lng` : Coordonnées destination
- `estimatedFare` : Tarif estimé avant course

**Champs métier :**
- `cancellationReason` : Raison d'annulation (audit)
- `passengers` : Nombre de passagers (défaut 1)

**Indexes :**
- Composite sur `(status, pickupTime)` pour dashboard
- Index sur `customerId` et `driverId` pour historique

### Trip
Représente une course effectivement réalisée (booking COMPLETED).

**Relation 1:1 avec Booking** via `bookingId` unique.

**Champs de performance :**
- `distance` : Distance réelle parcourue (km)
- `startTime/endTime` : Horodatage précis de la course
- `customerRating/driverRating` : Évaluations bilatérales

### Transaction
Représente le paiement d'une course.

**Méthodes supportées :**
- `CASH` : Paiement en espèces
- `ORANGE_MONEY` : Paiement mobile (API Orange)

**Champs de traçabilité :**
- `reference` : Référence externe (Orange Money)
- `metadata` : JSON avec détails techniques

## Business Rules

### Validation des Données

**Numéros de téléphone :**
- Format strict : `+269XXXXXXX` (7 chiffres après +269)
- Validation via `validateComorianPhone()`

**Coordonnées GPS :**
- Périmètre Comores : lat [-12.8, -11.3], lng [43.0, 44.8]
- Validation via `validateCoordinates()`

**Zones supportées :**
- Moroni, Mutsamudu, Fomboni, Iconi, Mitsamiouli, Mbeni, Foumbouni
- Validation via `validateZone()`

### Règles Métier

**Tarification :**
```typescript
fare = 200 KMF (base) + distance_km * 150 KMF
```

**Rétention des données :**
- 2 ans pour données personnelles (RGPD)
- Conservation infinie pour données anonymisées (analytics)

**Disponibilité chauffeur :**
- `isOnline` = false après 30min d'inactivité
- `lastSeenAt` mis à jour à chaque interaction

**Matching chauffeur :**
1. Zone de service (zones[])
2. Disponibilité (isAvailable && isOnline && isVerified)
3. Proximité GPS (rayon 10km)
4. Note (rating >= 4.0)
5. Activité récente (lastSeenAt < 15min)

## Performance Optimizations

### Indexes Stratégiques

**Requêtes de matching :**
```sql
-- Recherche chauffeurs disponibles
CREATE INDEX driver_availability_idx ON Driver(isAvailable, isVerified, isOnline);

-- Recherche par zone
CREATE INDEX driver_zones_idx ON Driver USING GIN(zones);
```

**Analytics temporelles :**
```sql
-- Bookings par période
CREATE INDEX booking_time_status_idx ON Booking(status, pickupTime);

-- Historique paiements
CREATE INDEX transaction_status_idx ON Transaction(status, createdAt);
```

### Requêtes Optimisées

**Matching chauffeur par zone :**
```typescript
const availableDrivers = await prisma.driver.findMany({
  where: {
    zones: { has: pickupZone },
    isAvailable: true,
    isOnline: true,
    isVerified: true,
    lastSeenAt: { gte: fifteenMinutesAgo }
  },
  orderBy: [
    { rating: 'desc' },
    { lastSeenAt: 'desc' }
  ],
  take: 5
});
```

**Dashboard temps réel :**
```typescript
const stats = await prisma.booking.groupBy({
  by: ['status'],
  where: {
    createdAt: { gte: today }
  },
  _count: true
});
```

## Data Migration Strategy

### Versioning
- Migrations Prisma avec rollback
- Scripts de migration personnalisés pour données complexes
- Tests de migration sur environnement staging

### Backup
- Dump PostgreSQL quotidien
- Sauvegarde incrémentale WAL
- Rétention 30 jours minimum

## Security Considerations

### Données Sensibles
- Masquage des numéros de téléphone dans les logs
- Chiffrement des données de géolocalisation sensibles
- Audit trail pour accès aux données personnelles

### Access Control
- Accès lecture seule pour analytics
- Accès restreint aux données client/chauffeur
- Logs d'accès pour conformité RGPD

## Monitoring & Alerts

### Métriques Clés
- Temps de réponse des requêtes (< 100ms)
- Taux d'erreur base de données (< 0.1%)
- Connexions actives (< 80% du pool)

### Alertes
- Croissance anormale des tables
- Blocages de requêtes > 5s
- Échecs de connexion répétés

## Future Enhancements

### Géospatial
- Migration vers PostGIS pour requêtes spatiales avancées
- Index géospatiaux pour matching par proximité
- Support des polygones de zones complexes

### Analytics
- Data warehouse séparé pour historique
- Réplication read-only pour reporting
- Anonymisation automatique des données anciennes

### Scalabilité
- Partitioning des tables par date
- Read replicas pour requêtes analytiques
- Cache Redis pour données fréquemment accédées

---

**Version :** 1.0  
**Dernière mise à jour :** 2024-12-17  
**Auteur :** Équipe Como Ride