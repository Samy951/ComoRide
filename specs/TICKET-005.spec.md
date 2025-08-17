# TICKET-005 : Interface Web Admin

**Version** : 1.0  
**Date** : 2025-08-17  
**Développeur** : Claude  

## Résumé

Interface web d'administration pour gérer les chauffeurs et visualiser les réservations de Como Ride.
Interface React TypeScript servie par Express à `/admin` avec authentification simple et fonctionnalités CRUD.

## Objectifs

- Interface admin complète accessible via `/admin`
- Gestion CRUD des chauffeurs avec vérification
- Dashboard temps réel des réservations
- Monitoring basique (courses/jour, chauffeurs actifs)
- Architecture monorepo avec types partagés

## Contraintes

- **Délai** : 4-5 jours maximum
- **Stack imposée** : React + TypeScript + Tailwind + Express
- **Simplicité** : Interface fonctionnelle, pas de sur-design
- **Budget** : Réutiliser l'API et DB existantes
- **Déploiement** : Build React servi par Express

---

## Spécifications Backend

### 1. Authentification Admin

#### Endpoints

**POST /api/v1/admin/login**
```typescript
Request: {
  password: string
}
Response: {
  success: boolean
  data?: {
    token: string // JWT valide 24h
    admin: {
      id: string
      role: "admin"
      loginAt: string
    }
  }
  error?: ApiError
}
```

**POST /api/v1/admin/logout**
```typescript
Headers: { Authorization: "Bearer <token>" }
Response: {
  success: boolean
}
```

**GET /api/v1/admin/me**
```typescript
Headers: { Authorization: "Bearer <token>" }
Response: {
  success: boolean
  data?: {
    id: string
    role: "admin"
    loginAt: string
  }
}
```

#### Configuration
- Variable `.env` : `ADMIN_PASSWORD=motdepasse123`
- JWT secret : `JWT_SECRET_ADMIN` (différent de l'existant)
- Expiration token : 24h

#### Middleware
```typescript
// src/middleware/admin.middleware.ts
export const requireAdmin = (req, res, next) => {
  // Vérifier Bearer token JWT
  // Valider le payload admin
  // Ajouter req.admin = { id, role }
}
```

### 2. API Drivers Management

**GET /api/v1/admin/drivers**
```typescript
Query: {
  page?: number // default: 1
  limit?: number // default: 20
  search?: string // recherche nom/téléphone
  status?: "all" | "verified" | "unverified" | "active" | "inactive"
  zone?: string
  sortBy?: "name" | "createdAt" | "rating"
  sortOrder?: "asc" | "desc"
}
Response: {
  success: boolean
  data?: {
    drivers: DriverWithStats[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}

interface DriverWithStats {
  id: string
  phoneNumber: string // masqué: +269XX***XX
  name: string
  licenseNumber: string
  vehicleType: string
  vehiclePlate: string
  rating: number
  isAvailable: boolean
  isOnline: boolean
  isVerified: boolean
  zones: string[]
  lastSeenAt: string | null
  createdAt: string
  // Stats additionnelles
  totalTrips: number
  completedTrips: number
  cancelledTrips: number
  averageRating: number
}
```

**GET /api/v1/admin/drivers/:id**
```typescript
Response: {
  success: boolean
  data?: {
    driver: DriverDetailed
    recentBookings: BookingBasic[] // 10 dernières
    stats: {
      totalTrips: number
      completedTrips: number
      cancelledTrips: number
      totalEarnings: number
      averageRating: number
      averageResponseTime: number // minutes
    }
  }
}
```

**POST /api/v1/admin/drivers**
```typescript
Request: {
  phoneNumber: string // format +269XXXXXXXX
  name: string
  licenseNumber: string
  vehicleType: "SEDAN" | "SUV" | "MOTORCYCLE" | "VAN"
  vehiclePlate: string
  zones: string[] // ["Moroni", "Mutsamudu", ...]
  isVerified?: boolean // default: false
}
Response: {
  success: boolean
  data?: { driver: DriverBasic }
  error?: {
    code: "PHONE_EXISTS" | "LICENSE_EXISTS" | "VALIDATION_ERROR"
    message: string
    details?: ValidationError[]
  }
}
```

**PUT /api/v1/admin/drivers/:id**
```typescript
Request: Partial<{
  name: string
  licenseNumber: string
  vehicleType: string
  vehiclePlate: string
  zones: string[]
}>
Response: {
  success: boolean
  data?: { driver: DriverBasic }
}
```

**PUT /api/v1/admin/drivers/:id/verify**
```typescript
Request: {
  isVerified: boolean
  reason?: string // si false, raison du refus
}
Response: {
  success: boolean
  data?: {
    driver: { id: string, isVerified: boolean }
    notificationSent: boolean
  }
}
```

**PUT /api/v1/admin/drivers/:id/activate**
```typescript
Request: {
  isActive: boolean
  reason?: string // si false, raison de désactivation
}
Response: {
  success: boolean
  data?: {
    driver: { id: string, isActive: boolean }
  }
}
```

### 3. API Bookings Management

**GET /api/v1/admin/bookings**
```typescript
Query: {
  page?: number
  limit?: number
  dateFrom?: string // ISO date
  dateTo?: string // ISO date
  status?: BookingStatus | "all"
  driverId?: string
  customerId?: string
  sortBy?: "createdAt" | "pickupTime" | "status"
  sortOrder?: "asc" | "desc"
}
Response: {
  success: boolean
  data?: {
    bookings: BookingWithDetails[]
    pagination: PaginationInfo
  }
}

interface BookingWithDetails {
  id: string
  pickupAddress: string
  dropAddress: string
  pickupTime: string
  passengers: number
  status: BookingStatus
  estimatedFare: number | null
  createdAt: string
  customer: {
    id: string
    name: string
    phoneNumber: string // masqué
    rating: number
  }
  driver?: {
    id: string
    name: string
    phoneNumber: string // masqué
    vehicleType: string
    vehiclePlate: string
    rating: number
  }
  trip?: {
    id: string
    fare: number
    paymentStatus: PaymentStatus
  }
}
```

**GET /api/v1/admin/bookings/:id**
```typescript
Response: {
  success: boolean
  data?: {
    booking: BookingDetailed
    timeline: BookingTimelineEvent[]
  }
}

interface BookingTimelineEvent {
  timestamp: string
  event: "CREATED" | "ACCEPTED" | "CANCELLED" | "COMPLETED"
  actor: "customer" | "driver" | "admin" | "system"
  details?: string
}
```

**PUT /api/v1/admin/bookings/:id/cancel**
```typescript
Request: {
  reason: string
  refundCustomer?: boolean
  notifyDriver?: boolean
}
Response: {
  success: boolean
  data?: {
    booking: { id: string, status: "CANCELLED" }
    notificationsSent: {
      customer: boolean
      driver: boolean
    }
  }
}
```

### 4. API Stats & Monitoring

**GET /api/v1/admin/stats**
```typescript
Query: {
  period?: "today" | "week" | "month" // default: "today"
}
Response: {
  success: boolean
  data?: {
    overview: {
      totalBookingsToday: number
      completedTripsToday: number
      activeDrivers: number // isOnline = true
      onlineDrivers: number // lastSeenAt < 5min
      pendingBookings: number
      revenue: {
        today: number
        week: number
        month: number
      }
    }
    charts: {
      bookingsPerHour: Array<{ hour: number, count: number }>
      topZones: Array<{ zone: string, bookings: number }>
      driverPerformance: Array<{
        driverId: string
        name: string
        completedTrips: number
        rating: number
      }>
    }
  }
}
```

---

## Spécifications Frontend

### 1. Architecture React

```
admin-ui/
├── src/
│   ├── components/           # Composants réutilisables
│   │   ├── Layout/
│   │   │   ├── AdminLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── UI/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Toast.tsx
│   │   └── Forms/
│   │       ├── DriverForm.tsx
│   │       └── BookingFilters.tsx
│   ├── pages/               # Pages principales
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Drivers/
│   │   │   ├── DriversList.tsx
│   │   │   ├── DriverDetails.tsx
│   │   │   └── DriverForm.tsx
│   │   └── Bookings/
│   │       ├── BookingsList.tsx
│   │       └── BookingDetails.tsx
│   ├── services/           # API calls
│   │   ├── api.ts          # Axios config
│   │   ├── auth.service.ts
│   │   ├── drivers.service.ts
│   │   ├── bookings.service.ts
│   │   └── stats.service.ts
│   ├── hooks/             # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── usePolling.ts
│   │   ├── usePagination.ts
│   │   └── useFilters.ts
│   ├── types/            # Types TypeScript
│   │   ├── admin.types.ts
│   │   ├── drivers.types.ts
│   │   └── bookings.types.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

### 2. Composants Clés

#### AdminLayout
```typescript
interface AdminLayoutProps {
  children: React.ReactNode
}

// Fonctionnalités :
// - Header avec logout
// - Sidebar navigation
// - Responsive mobile
// - Toast notifications global
```

#### DataTable
```typescript
interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  pagination?: PaginationState
  onPaginationChange?: (pagination: PaginationState) => void
  loading?: boolean
  onRowClick?: (row: T) => void
}

// Fonctionnalités :
// - Tri colonnes
// - Pagination
// - Loading states
// - Actions par ligne
// - Responsive (scroll horizontal)
```

#### DriverForm
```typescript
interface DriverFormProps {
  driver?: Driver // undefined = création
  onSubmit: (data: DriverFormData) => Promise<void>
  onCancel: () => void
}

// Validation Zod :
// - phoneNumber: +269XXXXXXXX
// - name: 2-50 caractères
// - licenseNumber: unique, format spécifique
// - vehicleType: enum
// - zones: au moins 1 zone
```

### 3. Services API

#### api.ts
```typescript
// Configuration Axios
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000
})

// Interceptors
api.interceptors.request.use(addAuthToken)
api.interceptors.response.use(handleSuccess, handleAuthError)
```

#### auth.service.ts
```typescript
export const authService = {
  login: (password: string) => Promise<LoginResponse>
  logout: () => Promise<void>
  getCurrentUser: () => Promise<AdminUser>
  isAuthenticated: () => boolean
  getToken: () => string | null
}
```

### 4. Hooks Personnalisés

#### usePolling
```typescript
function usePolling<T>(
  fetchFn: () => Promise<T>,
  interval: number = 30000,
  enabled: boolean = true
): {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => void
}
```

#### useFilters
```typescript
function useFilters<T>(initialFilters: T) {
  return {
    filters: T
    updateFilter: (key: keyof T, value: T[keyof T]) => void
    resetFilters: () => void
    hasActiveFilters: boolean
  }
}
```

---

## Pages et Flows Utilisateur

### 1. Login (/admin/login)
- Formulaire mot de passe uniquement
- Validation côté client et serveur
- Redirection vers dashboard si déjà connecté
- Token JWT stocké en localStorage
- Message d'erreur si mauvais mot de passe

### 2. Dashboard (/admin)
- **Stats Overview** : cards avec chiffres clés
- **Réservations récentes** : tableau 20 dernières (auto-refresh 30s)
- **Chauffeurs en ligne** : badge count + liste quick
- **Actions rapides** : "Nouveau chauffeur", "Voir toutes réservations"

### 3. Gestion Chauffeurs (/admin/drivers)

#### Liste Chauffeurs
- **Tableau principal** : nom, téléphone, statut, zones, rating, actions
- **Filtres** : statut vérification, disponibilité, zones, recherche
- **Actions par ligne** : voir détails, modifier, toggle vérification/activation
- **Pagination** : 20 par page
- **Actions bulk** : activer/désactiver multiple

#### Détails Chauffeur (/admin/drivers/:id)
- **Infos générales** : coordonnées, véhicule, zones
- **Statistiques** : courses, ratings, revenus
- **Historique réservations** : tableau dernières courses
- **Actions** : modifier, toggle vérification, désactiver

#### Formulaire Chauffeur (/admin/drivers/new, /admin/drivers/:id/edit)
- **Infos personnelles** : nom, téléphone
- **Permis** : numéro, validation format
- **Véhicule** : type (select), plaque
- **Zones** : multi-select avec zones disponibles
- **Validation temps réel** avec Zod
- **Confirmation** avant sauvegarde

### 4. Gestion Réservations (/admin/bookings)

#### Liste Réservations
- **Tableau principal** : date, client, chauffeur, trajet, statut, montant
- **Filtres** : période (7 jours par défaut), statut, chauffeur
- **Auto-refresh** : 30 secondes
- **Actions** : voir détails, annuler (si PENDING/ACCEPTED)

#### Détails Réservation (/admin/bookings/:id)
- **Infos course** : adresses, horaire, passagers
- **Participants** : client et chauffeur avec ratings
- **Timeline** : historique des événements
- **Actions** : annuler avec raison, contacter participants

---

## Critères d'Acceptation

### Backend
- [ ] Tous les endpoints admin fonctionnels et testés
- [ ] Authentification JWT sécurisée avec expiration
- [ ] Validation Zod sur tous les inputs
- [ ] Logs des actions admin avec Winston
- [ ] Gestion erreurs avec codes appropriés
- [ ] Middleware requireAdmin opérationnel
- [ ] Soft delete pour chauffeurs (pas de suppression hard)

### Frontend
- [ ] Interface responsive (desktop-first)
- [ ] Authentification avec redirection automatique
- [ ] Tous les formulaires avec validation React Hook Form + Zod
- [ ] Auto-refresh données toutes les 30s sur dashboard et bookings
- [ ] Loading states sur toutes les actions async
- [ ] Messages d'erreur et de succès (toasts)
- [ ] Navigation breadcrumbs
- [ ] Confirmation sur actions critiques (suppression, annulation)

### Intégration
- [ ] Build React intégré dans Express (`npm run build:admin`)
- [ ] Route `/admin/*` servie par Express avec fallback SPA
- [ ] Variables d'environnement correctement configurées
- [ ] Scripts npm : `build:admin`, `dev:admin`, `build:all`
- [ ] Types TypeScript partagés entre frontend/backend

### Sécurité
- [ ] Numéros de téléphone masqués dans les réponses API
- [ ] Pas de données sensibles en logs
- [ ] Token JWT avec expiration appropriée
- [ ] Validation stricte des permissions admin
- [ ] Rate limiting sur les endpoints admin

---

## Definition of Done

### Code
- [ ] Code TypeScript sans erreurs de compilation
- [ ] Linting ESLint passé sans warnings
- [ ] Formatage Prettier appliqué
- [ ] Pas de console.log en production
- [ ] Types corrects sur toutes les interfaces

### Tests
- [ ] Endpoints API testables manuellement via Postman/curl
- [ ] Interface frontend testée manuellement sur tous les flows
- [ ] Tests d'intégration pour l'auth admin
- [ ] Vérification responsive sur desktop et tablette

### Documentation
- [ ] README mis à jour avec section admin
- [ ] Variables d'environnement documentées
- [ ] Scripts npm documentés
- [ ] Endpoints API documentés

### Déploiement
- [ ] Build production optimisé (taille < 2MB)
- [ ] Variables d'env production configurées
- [ ] Logs fonctionnels en production
- [ ] Interface accessible sur URL finale
- [ ] Performance acceptable (< 3s chargement initial)

---

## Notes Techniques

### Variables Environnement
```bash
# .env
ADMIN_PASSWORD=votre_mot_de_passe_securise
JWT_SECRET_ADMIN=secret_different_du_principal
CORS_ORIGIN=http://localhost:3000,https://votre-domaine.com
```

### Scripts Package.json
```json
{
  "scripts": {
    "dev:admin": "cd admin-ui && npm run dev",
    "build:admin": "cd admin-ui && npm run build && cp -r dist/* ../public/admin/",
    "build:all": "npm run build && npm run build:admin"
  }
}
```

### Structure Base de Données
Aucune modification DB requise. Utilise les modèles Prisma existants :
- `Driver` (avec nouveau champ `isActive` à ajouter)
- `Customer`
- `Booking`
- `Trip`
- `Transaction`

---

**Estimation finale** : 4-5 jours de développement pour une interface admin complète et fonctionnelle.