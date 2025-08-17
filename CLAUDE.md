# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Como Ride

Platform de mise en relation chauffeur/client via bot WhatsApp aux Comores.

## Tech Stack

- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **WhatsApp Bot**: whatsapp-web.js
- **Payment**: Orange Money API (when available)
- **Testing**: Jest + Supertest + ts-jest
- **Validation**: Zod for input validation
- **Logging**: Winston

## Common Commands

```bash
# Development
npm run dev          # Start dev server with hot reload
npm run build        # Build TypeScript to dist/
npm run start        # Start production server

# Database
npm run db:migrate   # Run Prisma migrations
npm run db:push      # Push schema changes (dev)
npm run db:seed      # Seed database with test data
npm run db:studio    # Open Prisma Studio GUI

# Testing
npm test             # Run all tests
npm run test:unit    # Run unit tests only
npm run test:int     # Run integration tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run typecheck    # Run TypeScript compiler checks
npm run format       # Format code with Prettier
```

## Architecture Overview

### Directory Structure
```
src/
├── controllers/     # Business logic handlers
├── services/        # External services (WhatsApp, DB, SMS)
├── models/          # Prisma models & types
├── routes/          # Express route definitions
├── middleware/      # Custom middleware (auth, validation)
├── utils/           # Shared utilities
├── bot/            # WhatsApp bot logic
│   ├── handlers/   # Message handlers
│   ├── flows/      # Conversation flows
│   └── states/     # State machine management
└── types/          # TypeScript type definitions
```

### Core Components

#### WhatsApp Bot
- Uses whatsapp-web.js for WhatsApp integration
- State machine for conversation management (bot/states/)
- Message handlers in bot/handlers/ for different conversation stages
- Flows in bot/flows/ define user journeys

#### Booking System
- Controllers handle booking logic (controllers/booking.controller.ts)
- Service layer manages driver matching (services/matching.service.ts)
- Real-time notifications via WhatsApp to drivers
- Prisma models: Booking, Driver, Customer, Trip

#### Driver Management
- Driver verification system (services/verification.service.ts)
- Availability zones management
- Rating system bidirectional
- Push notification system for new bookings

#### Payment Integration
- Orange Money API integration (when available)
- Cash payment fallback with validation
- Transaction history tracking
- Fraud prevention mechanisms

## Database Schema (Prisma)

Key models:
- **Customer**: WhatsApp number, name, rating, history
- **Driver**: Verified identity, license, vehicle, zones, availability
- **Booking**: Trip details, status, timestamps
- **Trip**: Completed journeys with ratings
- **Transaction**: Payment records

## Development Workflow

### 1. PLAN Phase (/ask mode)
- Clarify requirements before coding
- Ask questions about business logic
- Structure the problem
- Never write code in this phase

### 2. SPEC Phase
- Generate detailed .spec.md files in specs/
- Define API contracts, flows, constraints
- Wait for validation before coding

### 3. CODE Phase
- Implement exactly what's in the spec
- Write tests first for critical logic
- Use TypeScript strict mode (no `any`)
- Handle errors with try/catch
- Log with Winston

## Testing Strategy

- **Unit tests**: Business logic in isolation
- **Integration tests**: API endpoints with Supertest
- **Bot tests**: Mock WhatsApp interactions
- **DB tests**: Use test database or SQLite in-memory
- Minimum 80% coverage on critical paths

## WhatsApp Bot Guidelines

- Messages in French adapted for Comoros
- Response time < 3 seconds
- Graceful error handling with user-friendly messages
- State persistence between messages
- Fallback handlers for unknown inputs

## Security Considerations

- Never log sensitive data (phone numbers partially masked)
- Validate all inputs with Zod
- Rate limiting on API endpoints
- Driver identity verification required
- Transaction logs for audit trail

## Deployment

- Environment variables in .env (never commit)
- Database migrations run before deployment
- Health check endpoint at /health
- Graceful shutdown handling
- WhatsApp session persistence

## Key Business Context

Como Ride aims to reclaim market from Mwezo (competitor) by offering:
- Superior UX with intuitive bot interface
- Driver verification for safety
- Modification/cancellation features
- Trip history and ratings
- Reliable infrastructure with less bugs

Target market: Comoros (300k inhabitants, 90%+ WhatsApp adoption)