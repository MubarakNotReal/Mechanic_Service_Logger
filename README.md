# Auto Service Manager

A full-stack mechanic shop information logger for tracking customers, vehicles, and historical service notes. The project uses a Vite/React client, an Express backend, Drizzle ORM, and PostgreSQL.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm, npm, or yarn (examples below use `npm`)

## Quick start

1. **Install dependencies**
   ```pwsh
   npm install
   ```

      `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_NAME` environment variables when running the script.
      To rotate the password for an existing account, set `ADMIN_FORCE=1` (or append `-- --force` to the
      command) and re-run the script with the same username and a new password.
   ```sql
   CREATE DATABASE autoservice_manager;
   ```

3. **Configure environment variables**
   - Copy `.env.example` to `.env`:
     ```pwsh
     Copy-Item .env.example .env
     ```
   - Update the `DATABASE_URL` credentials and choose a strong `SESSION_SECRET`.

4. **Run database migrations**
   ```pwsh
   npm run db:push
   ```
   This applies the schema defined in `shared/schema.ts` and keeps the `migrations/` folder up to date.

   5. **Seed the mechanic account**
       ```pwsh
       npm run seed:admin -- mechanic "SuperSecret123" "Lead Mechanic"
       ```
       Replace the username, password, and display name as needed. You can also supply them via the
       `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_NAME` environment variables when running the script.

   6. **Start the development server**
   ```pwsh
   npm run dev
   ```
   The API and Vite dev server will be available on the port specified by `PORT` (defaults to `5000`).

## Database schema overview

| Table | Purpose |
| --- | --- |
| `users` | Authenticated staff with roles (`admin`, `mechanic`, `viewer`). |
| `customers` | Customer contact, phone, address, and notes. |
| `vehicles` | Vehicles linked to customers by plate number. |
| `services` | Repair/service visits with costs, status, and follow-up info. |
| `service_items` | Detailed line items for labor or parts used during a service. |
| `maintenance_reminders` | Optional reminders for upcoming maintenance or follow-ups. |

All enums and relationships live in `shared/schema.ts` and are shared with both client and server code.

## Authentication

- The API exposes **login only** (`POST /api/login`) via Passport's local strategy.
- Registration is disabled; seed your initial mechanic/admin account manually.
- Example SQL for creating an admin user (replace the password hash):
   ```sql
   INSERT INTO users (username, password, role, name)
   VALUES ('mechanic', '<hashed-password>', 'admin', 'Lead Mechanic');
   ```
   You can generate password hashes with the helper in `server/auth.ts` or a short script using the provided `hashPassword` utility.
- Prefer using the `npm run seed:admin` script described above to create or rotate the shop account. To reset a password:
   ```pwsh
   $env:ADMIN_FORCE="1"
   npm run seed:admin -- mechanic "NewPassword!" "Lead Mechanic"
   Remove-Item Env:ADMIN_FORCE
   ```
   Update `mechanic` and the display name as needed, then share the new credentials securely.

## Next steps

- Build UI flows for logging service visits and browsing history by customer/vehicle.
- Implement tooling to seed an initial admin user or provide a secure onboarding script.
- Add automated tests and CI to guard the schema.
