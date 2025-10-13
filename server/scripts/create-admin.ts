import "dotenv/config";
import { hashPassword } from "../utils/passwords";
import { storage } from "../storage";
import { db, pool } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const args = process.argv.slice(2);
  const envForce = process.env.ADMIN_FORCE === "true" || process.env.ADMIN_FORCE === "1";
  const forceIndex = args.findIndex((arg) => arg === "--force" || arg === "-f");
  const shouldRemoveFlag = forceIndex !== -1;
  const force = envForce || shouldRemoveFlag;
  if (shouldRemoveFlag) {
    args.splice(forceIndex, 1);
  }

  const username = args[0] || process.env.ADMIN_USERNAME;
  const password = args[1] || process.env.ADMIN_PASSWORD;
  const nameArg = args[2] || process.env.ADMIN_NAME;

  if (!username || !password) {
    console.error("Usage: npm run seed:admin -- <username> <password> [name] [--force]");
    console.error("Alternatively, set ADMIN_USERNAME and ADMIN_PASSWORD env vars.");
    process.exit(1);
  }

  const existing = await storage.getUserByUsername(username);
  if (existing) {
    if (!force) {
      console.log(
        `User '${username}' already exists (id=${existing.id}). Use --force to reset the password or provide a new username.`,
      );
      return;
    }

    const hashedPassword = await hashPassword(password);
    const name = nameArg ?? existing.name;
    await db
      .update(users)
      .set({ password: hashedPassword, name })
      .where(eq(users.id, existing.id));

    console.log(`Updated credentials for '${username}' (id=${existing.id}).`);
    console.log("Remember to communicate the new password securely to your team.");
    return;
  }

  const hashedPassword = await hashPassword(password);
  const user = await storage.createUser({
    username,
    password: hashedPassword,
    name: nameArg ?? "Shop Mechanic",
    role: "admin",
  });

  console.log(`Created admin user '${user.username}' with id ${user.id}.`);
  console.log("Remember to store the password securely; it won't be shown again.");
}

main()
  .catch((error) => {
    console.error("Failed to create admin user:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
