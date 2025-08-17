# Como Ride 🚗

Platform de mise en relation chauffeur/client via bot WhatsApp aux Comores.

## 📋 Prérequis

- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm >= 8.0.0

## 🚀 Installation rapide

### 1. Cloner le repository

```bash
git clone https://github.com/your-org/como-ride.git
cd como-ride
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration environnement

Copier le fichier `.env.example` en `.env` et configurer :

```bash
cp .env.example .env
```

### 4. Base de données

```bash
# Créer la base de données PostgreSQL
createdb como_ride

# Lancer les migrations
npm run db:migrate

# (Optionnel) Seed de données test
npm run db:seed
```

### 5. Démarrer le serveur

```bash
# Mode développement
npm run dev

# Mode production
npm run build
npm start
```

L'API sera accessible sur `http://localhost:3000`

## 📦 Scripts disponibles

```bash
npm run dev          # Serveur dev avec hot-reload
npm run build        # Build TypeScript
npm start            # Serveur production
npm test             # Lancer les tests
npm run test:watch   # Tests en mode watch
npm run test:coverage # Tests avec coverage
npm run lint         # Vérifier le code
npm run lint:fix     # Corriger le code
npm run format       # Formater avec Prettier
npm run typecheck    # Vérifier les types TypeScript
```

## 🗄️ Commandes Prisma

```bash
npm run db:migrate      # Migrations dev
npm run db:migrate:prod # Migrations production
npm run db:push        # Push schema (dev only)
npm run db:seed        # Seed database
npm run db:studio      # Interface GUI Prisma
```

## 🏗️ Architecture

```
src/
├── controllers/     # Logique métier
├── services/       # Services externes (WhatsApp, DB, SMS)
├── routes/         # Définition des routes Express
├── middleware/     # Middleware custom (auth, validation)
├── config/         # Configuration (logger, database)
├── utils/          # Utilitaires partagés
└── types/          # Types TypeScript
```

## 🔍 API Endpoints

### Health Check
- `GET /` - Info API
- `GET /api/v1/health` - Status serveur et DB

### Customers (à venir)
- `POST /api/v1/customers` - Créer client
- `GET /api/v1/customers/:id` - Détails client

### Drivers (à venir)
- `POST /api/v1/drivers` - Enregistrer chauffeur
- `GET /api/v1/drivers` - Liste chauffeurs
- `PATCH /api/v1/drivers/:id/availability` - Changer disponibilité

### Bookings (à venir)
- `POST /api/v1/bookings` - Créer réservation
- `GET /api/v1/bookings/:id` - Détails réservation
- `PATCH /api/v1/bookings/:id/status` - Modifier status

## 🧪 Tests

```bash
# Tous les tests
npm test

# Tests unitaires uniquement
npm test -- tests/unit

# Tests d'intégration
npm test -- tests/integration

# Coverage
npm run test:coverage
```

Coverage minimum : 70%

## 🔒 Sécurité

- Helmet.js pour headers sécurisés
- Rate limiting (100 req/15min par IP)
- Validation entrées avec Zod
- Logs avec Winston
- Variables environnement avec dotenv

## 🚢 Déploiement

### Railway (Recommandé)

1. Installer Railway CLI
2. Se connecter : `railway login`
3. Lier le projet : `railway link`
4. Déployer : `railway up`

### Variables d'environnement production

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=info
```

## 📝 Conventions de code

- TypeScript strict mode
- Pas de `any`
- ESLint + Prettier
- Commits conventionnels
- Tests pour logique critique

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add some AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 License

MIT

## 👥 Équipe

Como Ride Team - Comores

---

**Status** : 🟢 En développement actif