# TICKET-003 : API Foundation

## 📋 Objectif
Créer le squelette API REST MVP pour Como Ride avec les routes essentielles, middlewares de sécurité, logging Winston, et tests d'intégration.

## 🏗️ Architecture

### Routes API
```
/api/v1/
├── auth/
│   ├── POST /verify     # Vérification numéro WhatsApp
│   └── POST /logout     # Nettoyage session
├── drivers/
│   ├── PUT /availability  # Statut online/offline + zones
│   └── PUT /location     # Mise à jour position GPS
└── rides/
    ├── POST /           # Créer nouvelle réservation
    ├── GET /:id         # Détails réservation
    ├── PUT /:id/accept  # Driver accepte la course
    └── PUT /:id/cancel  # Annulation (client/driver)
```

### Middleware Pipeline
1. **Rate Limiting** : 200 req/15min par numéro téléphone
2. **Auth Middleware** : Vérification `phone` header → inject `req.user`
3. **Validation** : Schemas Zod par endpoint
4. **Role Check** : `requireDriver()` ou `requireCustomer()`

### Services
- **AuthService** : Vérification phone, sessions
- **DriverService** : Availability, location, matching
- **BookingService** : CRUD réservations, gestion statuts

## 📡 Spécifications API

### Format Standard Réponse
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string; // En français pour users comoriens
  };
}
```

### 1. Authentication Routes

#### POST /api/v1/auth/verify
**Description** : Vérification numéro WhatsApp en base
```typescript
// Request
{
  phoneNumber: string; // Format: +2693123456
}

// Response Success (200)
{
  success: true,
  data: {
    id: string;
    phoneNumber: string;
    type: "customer" | "driver";
    name: string;
  }
}

// Response Error (404)
{
  success: false,
  error: {
    code: "USER_NOT_FOUND",
    message: "Numéro non enregistré"
  }
}
```

**Validation Zod**:
```typescript
const verifySchema = z.object({
  phoneNumber: z.string().regex(/^\+269[36]\d{6}$/)
});
```

#### POST /api/v1/auth/logout
**Headers** : `phone: +2693123456`
**Response** : `{ success: true, data: null }`

### 2. Driver Routes

#### PUT /api/v1/drivers/availability
**Headers** : `phone: +2693123456`
**Middleware** : `requireDriver()`

```typescript
// Request
{
  isAvailable: boolean;
  isOnline: boolean;
  zones?: string[]; // ["Moroni", "Mutsamudu"]
}

// Response (200)
{
  success: true,
  data: {
    isAvailable: boolean;
    isOnline: boolean;
    zones: string[];
    lastSeenAt: string;
  }
}
```

**Validation** :
```typescript
const availabilitySchema = z.object({
  isAvailable: z.boolean(),
  isOnline: z.boolean(),
  zones: z.array(z.string()).optional()
});
```

#### PUT /api/v1/drivers/location
**Headers** : `phone: +2693123456`
**Middleware** : `requireDriver()`

```typescript
// Request
{
  latitude: number;
  longitude: number;
}

// Response (200)
{
  success: true,
  data: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  }
}
```

### 3. Rides Routes

#### POST /api/v1/rides
**Headers** : `phone: +2693123456`
**Middleware** : `requireCustomer()`

```typescript
// Request
{
  pickupAddress: string;
  dropAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
  pickupTime: string; // ISO datetime
  passengers: number;
  notes?: string;
}

// Response (201)
{
  success: true,
  data: {
    id: string;
    status: "PENDING";
    pickupAddress: string;
    dropAddress: string;
    pickupTime: string;
    passengers: number;
    estimatedFare?: number;
    createdAt: string;
  }
}
```

#### GET /api/v1/rides/:id
**Headers** : `phone: +2693123456`

```typescript
// Response (200)
{
  success: true,
  data: {
    id: string;
    status: "PENDING" | "ACCEPTED" | "CANCELLED" | "COMPLETED";
    pickupAddress: string;
    dropAddress: string;
    pickupTime: string;
    passengers: number;
    customer: {
      name: string;
      phoneNumber: string; // Masqué partiellement
    };
    driver?: {
      name: string;
      phoneNumber: string;
      vehicleType: string;
      vehiclePlate: string;
      rating: number;
    };
    estimatedFare?: number;
    createdAt: string;
    updatedAt: string;
  }
}
```

#### PUT /api/v1/rides/:id/accept
**Headers** : `phone: +2693123456`
**Middleware** : `requireDriver()`

```typescript
// Request
{
  estimatedFare?: number;
}

// Response (200)
{
  success: true,
  data: {
    id: string;
    status: "ACCEPTED";
    driver: {
      name: string;
      phoneNumber: string;
      vehicleType: string;
      vehiclePlate: string;
    };
    estimatedFare?: number;
    updatedAt: string;
  }
}
```

#### PUT /api/v1/rides/:id/cancel
**Headers** : `phone: +2693123456`

```typescript
// Request
{
  reason: string;
}

// Response (200)
{
  success: true,
  data: {
    id: string;
    status: "CANCELLED";
    cancellationReason: string;
    updatedAt: string;
  }
}
```

## 🔒 Middlewares

### 1. Rate Limiting
```typescript
// src/middleware/rateLimiter.middleware.ts
const phoneRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requêtes par numéro
  keyGenerator: (req) => req.headers.phone as string,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Trop de requêtes, veuillez patienter"
    }
  }
});
```

### 2. Auth Middleware
```typescript
// src/middleware/auth.middleware.ts
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    phoneNumber: string;
    type: "customer" | "driver";
    name: string;
  };
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const phone = req.headers.phone as string;
  
  if (!phone) {
    return res.status(401).json({
      success: false,
      error: {
        code: "MISSING_PHONE",
        message: "Numéro de téléphone requis"
      }
    });
  }

  // Recherche customer puis driver
  const user = await AuthService.findUserByPhone(phone);
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Utilisateur non autorisé"
      }
    });
  }

  req.user = user;
  next();
};

export const requireDriver = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user.type !== "driver") {
    return res.status(403).json({
      success: false,
      error: {
        code: "DRIVER_REQUIRED",
        message: "Accès réservé aux chauffeurs"
      }
    });
  }
  next();
};

export const requireCustomer = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user.type !== "customer") {
    return res.status(403).json({
      success: false,
      error: {
        code: "CUSTOMER_REQUIRED", 
        message: "Accès réservé aux clients"
      }
    });
  }
  next();
};
```

## 📝 Logging Winston

### Configuration
```typescript
// src/config/logger.ts
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'como-ride-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new DailyRotateFile({
      filename: 'logs/como-ride-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '10d',
      maxSize: '20m'
    }),
    new DailyRotateFile({
      filename: 'logs/como-ride-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d'
    })
  ]
});
```

### Log Structure
```typescript
// Request logging
logger.info('API Request', {
  method: req.method,
  url: req.url,
  phone: req.headers.phone,
  ip: req.ip,
  userAgent: req.get('user-agent'),
  requestId: uuid()
});

// Business logic logging
logger.info('Booking created', {
  bookingId: booking.id,
  customerId: booking.customerId,
  pickupAddress: booking.pickupAddress,
  requestId: req.requestId
});

// Error logging
logger.error('Database error', {
  error: error.message,
  stack: error.stack,
  query: 'findManyBookings',
  requestId: req.requestId
});
```

## 🧪 Tests d'Intégration

### Configuration Test Database
```typescript
// tests/setup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file::memory:?cache=shared'
    }
  }
});

beforeEach(async () => {
  // Reset database
  await prisma.$executeRaw`PRAGMA foreign_keys = OFF`;
  
  const tables = await prisma.$queryRaw<{name: string}[]>`
    SELECT name FROM sqlite_master WHERE type='table'
  `;
  
  for (const table of tables) {
    if (table.name !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`DELETE FROM ${table.name}`);
    }
  }
  
  await prisma.$executeRaw`PRAGMA foreign_keys = ON`;
  
  // Seed minimal data
  await seedTestData();
});
```

### Test Suites

#### 1. Auth Tests
```typescript
// tests/integration/auth.test.ts
describe('Auth API', () => {
  describe('POST /api/v1/auth/verify', () => {
    it('should verify existing customer phone', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: '+2693123456' });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: expect.any(String),
          phoneNumber: '+2693123456',
          type: 'customer',
          name: expect.any(String)
        }
      });
    });

    it('should return 404 for unknown phone', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: '+2693999999' });
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Numéro non enregistré'
        }
      });
    });
  });
});
```

#### 2. Driver Tests
```typescript
// tests/integration/drivers.test.ts
describe('Driver API', () => {
  describe('PUT /api/v1/drivers/availability', () => {
    it('should update driver availability', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/availability')
        .set('phone', '+2693987654')
        .send({
          isAvailable: true,
          isOnline: true,
          zones: ['Moroni', 'Mitsamiouli']
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isAvailable).toBe(true);
    });

    it('should reject customer access', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/availability')
        .set('phone', '+2693123456') // customer phone
        .send({ isAvailable: true, isOnline: true });
      
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('DRIVER_REQUIRED');
    });
  });
});
```

#### 3. Booking Flow Tests
```typescript
// tests/integration/booking-flow.test.ts
describe('Booking Flow', () => {
  it('should complete full booking cycle', async () => {
    // 1. Customer creates booking
    const createResponse = await request(app)
      .post('/api/v1/rides')
      .set('phone', '+2693123456')
      .send({
        pickupAddress: 'Place de France, Moroni',
        dropAddress: 'Aéroport Prince Said Ibrahim',
        pickupTime: new Date(Date.now() + 3600000).toISOString(),
        passengers: 2
      });
    
    expect(createResponse.status).toBe(201);
    const bookingId = createResponse.body.data.id;

    // 2. Driver accepts booking
    const acceptResponse = await request(app)
      .put(`/api/v1/rides/${bookingId}/accept`)
      .set('phone', '+2693987654')
      .send({ estimatedFare: 5000 });
    
    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.data.status).toBe('ACCEPTED');

    // 3. Verify booking details
    const detailsResponse = await request(app)
      .get(`/api/v1/rides/${bookingId}`)
      .set('phone', '+2693123456');
    
    expect(detailsResponse.status).toBe(200);
    expect(detailsResponse.body.data.driver).toBeDefined();
  });
});
```

## 📂 Structure Fichiers

```
src/
├── controllers/
│   ├── auth.controller.ts
│   ├── driver.controller.ts
│   └── booking.controller.ts
├── services/
│   ├── auth.service.ts
│   ├── driver.service.ts
│   └── booking.service.ts
├── middleware/
│   ├── auth.middleware.ts
│   ├── rateLimiter.middleware.ts
│   └── validation.middleware.ts (existant, à étendre)
├── routes/
│   ├── auth.routes.ts
│   ├── driver.routes.ts
│   └── booking.routes.ts
├── schemas/
│   ├── auth.schemas.ts
│   ├── driver.schemas.ts
│   └── booking.schemas.ts
└── types/
    └── api.types.ts

tests/
├── integration/
│   ├── auth.test.ts
│   ├── drivers.test.ts
│   └── booking-flow.test.ts
└── fixtures/
    └── test-data.ts
```

## ✅ Critères d'Acceptation

1. **Routes fonctionnelles** : Toutes les routes répondent selon spec
2. **Auth middleware** : Vérification phone + injection user
3. **Validation Zod** : Tous les endpoints validés
4. **Rate limiting** : 200 req/15min par téléphone
5. **Logs Winston** : Format JSON, rotation quotidienne
6. **Tests passants** : 3 suites d'intégration > 90% coverage
7. **Format réponse** : Wrapper `{success, data, error}` uniforme
8. **Messages français** : Erreurs en français pour users comoriens

## 🚀 Points de Validation

- [ ] API répond à toutes les routes avec format correct
- [ ] Middleware auth bloque accès non autorisé  
- [ ] Rate limiting fonctionne par numéro téléphone
- [ ] Logs Winston écrits en JSON rotatif
- [ ] Tests d'intégration passent avec SQLite mémoire
- [ ] Validation Zod rejette données invalides
- [ ] Erreurs en français retournées aux clients