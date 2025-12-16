# StayOne Booking Platform

## Overview

StayOne is a property booking platform with blockchain/wallet integration for payments. The system manages booking requests between guests and hosts, handles payments and refunds, and maintains comprehensive audit logs for all transactions. The application features a React frontend with a shadcn/ui component library and an Express.js backend with PostgreSQL database storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming, supporting dark mode

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful API with JSON request/response format
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Role-based Access**: Middleware supports role verification (guest, host, admin roles)
- **Audit Logging**: All entity changes are logged with previous/new state tracking

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Key Entities**:
  - Users (with wallet addresses for blockchain integration)
  - Booking Requests (guest-host property reservations)
  - Payments (transaction records with blockchain tx hashes)
  - Fee Payments (platform fees)
  - Refunds (refund processing)
  - Stay Status (check-in/check-out tracking)
  - Policies (booking policies)
  - Audit Logs (comprehensive change tracking)

### Build System
- **Client Build**: Vite bundles the React application to `dist/public`
- **Server Build**: esbuild compiles TypeScript server to CommonJS
- **Development**: Hot module replacement via Vite dev server proxied through Express

### Project Structure
```
client/           # React frontend application
  src/
    components/ui/  # shadcn/ui components
    hooks/          # Custom React hooks
    lib/            # Utility functions and query client
    pages/          # Page components
server/           # Express.js backend
  auth.ts         # JWT authentication logic
  routes.ts       # API route definitions
  storage.ts      # Database operations
  static.ts       # Static file serving
shared/           # Shared code between client/server
  schema.ts       # Drizzle database schema
```

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management
- **drizzle-kit**: Database migration tool (`npm run db:push`)

### Authentication
- **jsonwebtoken**: JWT token generation and verification
- **bcrypt**: Password hashing with configurable salt rounds
- **JWT_SECRET**: Environment variable for token signing (defaults to dev secret)

### Frontend Libraries
- **@tanstack/react-query**: Server state synchronization
- **@radix-ui/***: Accessible UI primitive components
- **wouter**: Lightweight client-side routing
- **date-fns**: Date manipulation utilities
- **zod**: Runtime schema validation (shared between client/server)

### Replit Integration
- **@replit/vite-plugin-runtime-error-modal**: Error overlay in development
- **@replit/vite-plugin-cartographer**: Development tooling
- **@replit/vite-plugin-dev-banner**: Development environment indicator
- **vite-plugin-meta-images**: OpenGraph image handling for deployments