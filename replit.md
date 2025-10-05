# AutoShop Manager - Mechanic Shop Management System

## Overview

AutoShop Manager is a full-stack web application designed for mechanic shops to manage customer information, vehicle details, repair history, and service records. The system provides a comprehensive solution for tracking customer visits, recording work performed, managing parts replacement, and calculating service costs. Built with a focus on efficiency and data clarity, it enables shop owners and mechanics to maintain detailed records and quickly access customer and vehicle information through an intuitive interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server for fast HMR (Hot Module Replacement)
- **Wouter** for lightweight client-side routing
- **TanStack Query (React Query)** for server state management, caching, and data synchronization

**UI Component System**
- **shadcn/ui** component library built on **Radix UI** primitives
- **Tailwind CSS** for utility-first styling with custom design system
- **Design Philosophy**: Productivity-focused interface with dark mode as primary theme, optimized for workshop environments with high contrast and readability
- Custom color palette using HSL values for both light and dark modes
- Typography using Inter font family for clean, professional aesthetics

**State Management Pattern**
- Server state managed through React Query with optimistic updates
- Authentication state via React Context (`AuthProvider`)
- Theme state via React Context (`ThemeProvider`)
- Form state managed locally with controlled components

### Backend Architecture

**Server Framework**
- **Express.js** with TypeScript for RESTful API endpoints
- **Node.js** runtime environment
- Session-based authentication using **Passport.js** with local strategy
- **express-session** with PostgreSQL session store for persistent sessions

**Authentication & Authorization**
- Password hashing using Node's native `scrypt` with salt
- Role-based access control (RBAC) with three roles: admin, mechanic, viewer
- Custom middleware (`requireAuth`, `requireRole`) for route protection
- Session management with secure cookie configuration

**API Design Pattern**
- RESTful endpoints following resource-based routing
- Centralized error handling middleware
- Request/response logging for API endpoints
- CORS and security headers configured via Express middleware

### Data Storage Solutions

**Database**
- **PostgreSQL** via **Neon Serverless** for cloud-hosted database
- **Drizzle ORM** for type-safe database queries and schema management
- WebSocket connection pooling for serverless environment

**Schema Design**
The system uses four core relational tables:

1. **Users Table**: Authentication and role management
   - UUID primary key
   - Username/password credentials
   - Role enum (admin, mechanic, viewer)

2. **Customers Table**: Customer records with phone as unique identifier
   - Serial ID primary key
   - Phone number (unique), name, email, address, notes
   - Timestamp tracking (createdAt)

3. **Vehicles Table**: Vehicle information linked to customers
   - Serial ID primary key
   - Foreign key to customers with cascade delete
   - Plate number (unique), make, model, year
   - One-to-many relationship with customers

4. **Services Table**: Service history and repair records
   - Serial ID primary key
   - Foreign keys to both vehicles and customers with cascade delete
   - Service details: date, work performed, parts replaced
   - Cost breakdown: labor cost, parts cost, total cost (numeric fields)
   - Optional mechanic name field

**Validation**
- **Zod schemas** derived from Drizzle schemas using `drizzle-zod`
- Server-side validation on all API endpoints
- Type-safe data insertion and updates

### External Dependencies

**Core Runtime Dependencies**
- `@neondatabase/serverless` - Neon PostgreSQL serverless driver
- `drizzle-orm` - Type-safe ORM for PostgreSQL
- `express` with `express-session` - Web server and session management
- `passport` with `passport-local` - Authentication strategy
- `connect-pg-simple` - PostgreSQL session store

**Frontend Libraries**
- `@tanstack/react-query` - Server state management
- `react-hook-form` with `@hookform/resolvers` - Form handling
- `date-fns` - Date formatting and manipulation
- `wouter` - Lightweight routing
- `class-variance-authority` and `clsx` - Dynamic className utilities

**UI Component Ecosystem**
- `@radix-ui/*` - Comprehensive set of headless UI primitives (dialogs, dropdowns, tooltips, etc.)
- `tailwindcss` - Utility-first CSS framework
- `lucide-react` - Icon library
- `cmdk` - Command palette component
- `embla-carousel-react` - Carousel functionality

**Development Tools**
- `vite` - Build tool and dev server
- `typescript` - Type checking
- `tsx` - TypeScript execution for Node.js
- `esbuild` - Production bundling for server code
- `drizzle-kit` - Database migration tool

**Replit-Specific Integrations**
- `@replit/vite-plugin-runtime-error-modal` - Enhanced error reporting
- `@replit/vite-plugin-cartographer` - Development tooling (dev only)
- `@replit/vite-plugin-dev-banner` - Development banner (dev only)