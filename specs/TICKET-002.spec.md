# TICKET-002 : Modèle de données et DB

## Objectifs

### Objectif principal
Implémenter un schéma de base de données robuste et testé pour la plateforme Como Ride, optimisé pour concurrencer Mwezo avec des fonctionnalités spécifiques aux Comores.

### Objectifs spécifiques
- **Localisation** : Support des numéros de téléphone comoriens (+269)
- **Géolocalisation** : Coordonnées GPS de base pour pickup/drop et position chauffeur
- **Disponibilité** : Tracking statut online/offline des chauffeurs
- **Traçabilité** : Raisons d'annulation et historique
- **Performance** : Seed data réaliste pour tests de charge
- **Qualité** : Tests complets avec couverture minimale 80%

## Critères d'acceptation

### CA-001 : Schéma Prisma étendu
- ✅ Modèle Driver enrichi avec isOnline, lastSeenAt, coordonnées actuelles
- ✅ Modèle Booking enrichi avec cancellationReason, coordonnées pickup/drop, estimatedFare
- ✅ Contraintes de validation au niveau DB (indexes, foreign keys)
- ✅ Respect des conventions de nommage TypeScript/Prisma

### CA-002 : Migration fonctionnelle
- ✅ Migration SQL générée sans erreur
- ✅ Rollback possible
- ✅ Seed data compatible avec nouveau schéma
- ✅ Aucune perte de données existantes

### CA-003 : Validation métier
- ✅ Fonction validateComorianPhone() accepte format +269XXXXXXX (7 chiffres après +269)
- ✅ Fonction validateCoordinates() vérifie lat/lng dans périmètre Comores
- ✅ Fonction calculateEstimatedFare() retourne tarif basique par distance

### CA-004 : Seed data réaliste
- ✅ Minimum 10 customers avec vrais numéros +269
- ✅ Minimum 8 drivers répartis sur zones principales (Moroni, Mutsamudu, Fomboni)
- ✅ Mix de bookings dans tous les états possibles
- ✅ Coordonnées GPS réelles des lieux emblématiques

### CA-005 : Tests complets
- ✅ Tests unitaires : modèles Customer, Driver, Booking + utils validation
- ✅ Tests intégration : workflows booking, matching driver, intégrité transactionnelle
- ✅ Couverture ≥ 80% sur code critique (modèles, validation)
- ✅ Tous les tests passent avec npm test

## Schéma DB détaillé

### Modèle Customer (existant, inchangé)
```prisma
model Customer {
  id          String   @id @default(cuid())
  phoneNumber String   @unique
  name        String
  rating      Float    @default(5.0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  bookings    Booking[]
  trips       Trip[]    @relation("CustomerTrips")
  
  @@index([phoneNumber])
}
```

### Modèle Driver (enrichi)
```prisma
model Driver {
  id             String    @id @default(cuid())
  phoneNumber    String    @unique
  name           String
  licenseNumber  String    @unique
  vehicleType    String
  vehiclePlate   String
  rating         Float     @default(5.0)
  isAvailable    Boolean   @default(true)
  isOnline       Boolean   @default(false)         // NOUVEAU
  isVerified     Boolean   @default(false)
  zones          String[]  // Array of zone names
  currentLat     Float?                            // NOUVEAU
  currentLng     Float?                            // NOUVEAU
  lastSeenAt     DateTime?                         // NOUVEAU
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  bookings       Booking[]
  trips          Trip[]    @relation("DriverTrips")
  
  @@index([phoneNumber])
  @@index([isAvailable, isVerified])
  @@index([isOnline])                              // NOUVEAU
}
```

### Modèle Booking (enrichi)
```prisma
model Booking {
  id                String        @id @default(cuid())
  customerId        String
  driverId          String?
  pickupAddress     String
  dropAddress       String
  pickupLat         Float?                         // NOUVEAU
  pickupLng         Float?                         // NOUVEAU
  dropLat           Float?                         // NOUVEAU
  dropLng           Float?                         // NOUVEAU
  pickupTime        DateTime
  passengers        Int           @default(1)
  status            BookingStatus @default(PENDING)
  notes             String?
  cancellationReason String?                      // NOUVEAU
  estimatedFare     Float?                        // NOUVEAU
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  customer          Customer      @relation(fields: [customerId], references: [id])
  driver            Driver?       @relation(fields: [driverId], references: [id])
  trip              Trip?
  
  @@index([status, pickupTime])
  @@index([customerId])
  @@index([driverId])
}
```

### Modèles existants (Trip, Transaction, Enums)
- **Inchangés** : Trip, Transaction, BookingStatus, PaymentMethod, PaymentStatus
- Maintien de l'intégrité référentielle

## Spécifications techniques

### Contraintes de validation
- **phoneNumber** : Regex `/^\+269\d{7}$/` (format comorien)
- **currentLat/Lng** : Bounds Comores approximatives (lat: -12.8 à -11.3, lng: 43.0 à 44.8)
- **estimatedFare** : ≥ 0, en francs comoriens (KMF)
- **zones** : Array non vide pour drivers vérifiés

### Index de performance
- Driver.isOnline pour requêtes de matching rapides
- Booking coordonnées pour recherches géospatiales futures
- lastSeenAt pour nettoyage périodique

### Règles métier
- **Rétention** : 2 ans pour données personnelles (RGPD)
- **isOnline** : Auto-reset à false après 30min d'inactivité (future implementation)
- **Zones supportées** : Moroni, Mutsamudu, Fomboni, Iconi, Mitsamiouli, Mbeni

## Tests requis

### Tests unitaires (tests/unit/models/)
1. **customer.test.ts**
   - Création customer valide
   - Validation numéro +269
   - Unicité phoneNumber
   - Relations bookings/trips

2. **driver.test.ts**
   - États isAvailable/isOnline
   - Validation zones
   - Coordonnées currentLat/Lng
   - Update lastSeenAt

3. **booking.test.ts**
   - Transitions d'état valides
   - Validation cancellationReason
   - Coordonnées pickup/drop
   - Calcul estimatedFare

4. **utils/validation.test.ts**
   - validateComorianPhone() : cas valides/invalides
   - validateCoordinates() : dans/hors périmètre Comores
   - calculateEstimatedFare() : calculs distance/tarif

### Tests d'intégration (tests/integration/database/)
1. **booking-flow.test.ts**
   - Workflow : PENDING → ACCEPTED → COMPLETED
   - Annulation avec raison
   - Matching driver disponible

2. **driver-matching.test.ts**
   - Recherche par zone et disponibilité
   - Filtrage isOnline=true
   - Distance GPS basique

3. **transaction-integrity.test.ts**
   - Cohérence Booking ↔ Trip ↔ Transaction
   - Contraintes foreign keys
   - Rollback transactions

### Seuil de couverture
- **Minimum global** : 80%
- **Code critique** : 95% (validation, modèles Prisma)
- **Exclusions** : node_modules, migrations générées

## Livrables

### Code
- [ ] prisma/schema.prisma mis à jour
- [ ] Migration SQL validée
- [ ] src/utils/validation.ts avec fonctions spécialisées
- [ ] prisma/seed.ts enrichi avec données comoriennes
- [ ] Tests unitaires complets (4 fichiers)
- [ ] Tests intégration (3 fichiers)

### Documentation
- [ ] specs/database.md : ERD et règles métier
- [ ] Commentaires JSDoc sur fonctions validation
- [ ] README section "Database" mise à jour

### Validation
- [ ] npm run db:migrate sans erreur
- [ ] npm run db:seed peuple 10+ customers, 8+ drivers
- [ ] npm test : 100% pass, couverture ≥ 80%
- [ ] npm run typecheck : 0 erreur TypeScript

## Definition of Done

### Technique
- ✅ Code review passed (simulation via tests)
- ✅ TypeScript strict mode compliance
- ✅ ESLint/Prettier clean
- ✅ Migration reversible
- ✅ Seed data realistic and diverse

### Fonctionnel
- ✅ Tous critères d'acceptation validés
- ✅ Tests passent en local et CI
- ✅ Documentation à jour
- ✅ Pas de régression sur fonctionnalités existantes

### Business
- ✅ Support numéros téléphone comoriens
- ✅ Géolocalisation basique fonctionnelle
- ✅ Tracking disponibilité chauffeurs
- ✅ Foundation solide pour features futures (WhatsApp bot, paiements)

## Risques et mitigations

### Risque 1 : Performance avec coordonnées GPS
- **Mitigation** : Index sur coordonnées, requêtes optimisées dès le design

### Risque 2 : Migration sur données existantes
- **Mitigation** : Fields optionnels, backward compatibility, tests rollback

### Risque 3 : Validation numéros +269 trop stricte
- **Mitigation** : Regex testée avec vrais numéros comoriens, fallback graceful

---

**Estimé** : 1-2 jours développement
**Priorité** : Haute (bloquant pour bot WhatsApp)
**Dépendances** : Aucune