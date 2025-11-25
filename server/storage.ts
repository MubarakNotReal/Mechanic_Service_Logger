import {
  users,
  customers,
  vehicles,
  services,
  serviceMedia,
  type User,
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Vehicle,
  type InsertVehicle,
  type Service,
  type InsertService,
  type ServiceMedia,
  type InsertServiceMedia,
} from "@shared/schema";
import { db } from "./db";
import { eq, or, like, ilike, desc, sql, type SQL } from "drizzle-orm";
import session from "express-session";
import { pool } from "./db";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

type ServiceInsert = typeof services.$inferInsert;
export type VehicleWithCustomer = {
  vehicle: Vehicle;
  customer: Customer | null;
};

const MIN_SUBSTRING_LENGTH = 3;

const escapeLikePattern = (value: string): string => value.replace(/[%_]/g, (match) => `\\${match}`);

const buildFuzzyPatterns = (value: string): string[] => {
  const normalized = value.trim();
  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>();
  const escaped = escapeLikePattern(normalized);
  candidates.add(`%${escaped}%`);

  if (normalized.length >= MIN_SUBSTRING_LENGTH + 1) {
    for (let index = 0; index < normalized.length; index += 1) {
      const variant = normalized.slice(0, index) + normalized.slice(index + 1);
      if (variant.length >= MIN_SUBSTRING_LENGTH) {
        candidates.add(`%${escapeLikePattern(variant)}%`);
      }
    }
  }

  for (const token of normalized.split(/\s+/)) {
    if (token.length >= MIN_SUBSTRING_LENGTH) {
      candidates.add(`%${escapeLikePattern(token)}%`);
    }
  }

  return Array.from(candidates.values());
};

const buildDigitPatterns = (value: string): string[] => {
  const digitsOnly = value.replace(/\D/g, "").trim();
  if (!digitsOnly) {
    return [];
  }

  const candidates = new Set<string>();
  candidates.add(`%${digitsOnly}%`);

  if (digitsOnly.length >= MIN_SUBSTRING_LENGTH + 1) {
    for (let index = 0; index < digitsOnly.length; index += 1) {
      const variant = digitsOnly.slice(0, index) + digitsOnly.slice(index + 1);
      if (variant.length >= MIN_SUBSTRING_LENGTH) {
        candidates.add(`%${variant}%`);
      }
    }
  }

  return Array.from(candidates.values());
};

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }

  const aLength = a.length;
  const bLength = b.length;

  if (aLength === 0) {
    return bLength;
  }

  if (bLength === 0) {
    return aLength;
  }

  const matrix: number[][] = Array.from({ length: aLength + 1 }, () => new Array<number>(bLength + 1));

  for (let i = 0; i <= aLength; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= bLength; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= aLength; i += 1) {
    const charA = a.charCodeAt(i - 1);
    for (let j = 1; j <= bLength; j += 1) {
      const charB = b.charCodeAt(j - 1);
      const cost = charA === charB ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[aLength][bLength];
};

const computeCandidateScore = (
  normalizedTerm: string,
  digitOnlyTerm: string,
  entry: VehicleWithCustomer,
): number => {
  if (!normalizedTerm && !digitOnlyTerm) {
    return 0;
  }

  const comparisonValues: string[] = [];
  if (entry.vehicle.plateNumber) {
    comparisonValues.push(entry.vehicle.plateNumber.toUpperCase());
  }
  const vehicleLabel = `${entry.vehicle.make} ${entry.vehicle.model}`.trim();
  if (vehicleLabel) {
    comparisonValues.push(vehicleLabel.toUpperCase());
  }
  if (entry.customer?.name) {
    comparisonValues.push(entry.customer.name.toUpperCase());
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  const termLength = Math.max(normalizedTerm.length, 1);

  for (const value of comparisonValues) {
    if (!value) {
      continue;
    }
    const distance = levenshteinDistance(normalizedTerm, value);
    const normalizedDistance = distance / Math.max(value.length, termLength, 1);
    if (normalizedDistance < bestDistance) {
      bestDistance = normalizedDistance;
    }
    if (value.includes(normalizedTerm) || normalizedTerm.includes(value)) {
      bestDistance = Math.min(bestDistance, 0.05);
    }
  }

  if (digitOnlyTerm && entry.customer?.phone) {
    const candidateDigits = entry.customer.phone.replace(/\D/g, "");
    if (candidateDigits) {
      const distance = levenshteinDistance(digitOnlyTerm, candidateDigits);
      const normalizedDistance = distance / Math.max(candidateDigits.length, digitOnlyTerm.length, 1);
      bestDistance = Math.min(bestDistance, normalizedDistance * 0.9);
    }
  }

  if (!Number.isFinite(bestDistance)) {
    return 0;
  }

  const clamped = Math.min(Math.max(bestDistance, 0), 1);
  return 1 - clamped;
};

export interface IStorage {
  sessionStore: session.Store;
  
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: InsertCustomer): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<void>;
  searchCustomers(query: string): Promise<Customer[]>;
  getCustomerByNormalizedPhone(phone: string): Promise<Customer | undefined>;
  getCustomersByExactName(name: string): Promise<Customer[]>;
  
  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  getVehicleByPlate(plateNumber: string): Promise<Vehicle | undefined>;
  getVehiclesByCustomer(customerId: number): Promise<Vehicle[]>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: InsertVehicle): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<void>;
  searchVehicleCandidates(term: string, limit?: number): Promise<VehicleWithCustomer[]>;
  
  getServices(): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  getServicesByVehicle(vehicleId: number): Promise<Service[]>;
  getServicesByCustomer(customerId: number): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  addServiceMedia(media: InsertServiceMedia[]): Promise<ServiceMedia[]>;
  getServiceMedia(serviceId: number): Promise<ServiceMedia[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ pool, createTableIfMissing: true });
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`);
    return user || undefined;
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.phone, phone));
    return customer || undefined;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db.insert(customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(id: number, customer: InsertCustomer): Promise<Customer | undefined> {
    const [updated] = await db
      .update(customers)
      .set(customer)
      .where(eq(customers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCustomer(id: number): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    return await db
      .select()
      .from(customers)
      .where(
        or(
          like(customers.name, `%${query}%`),
          like(customers.phone, `%${query}%`),
          like(customers.email, `%${query}%`)
        )
      );
  }

  async getCustomerByNormalizedPhone(phone: string): Promise<Customer | undefined> {
    const normalized = phone.replace(/\D/g, "");
    if (!normalized) {
      return undefined;
    }

    const [customer] = await db
      .select()
      .from(customers)
      .where(sql`regexp_replace(${customers.phone}, '\\D', '', 'g') = ${normalized}`)
      .limit(1);

    return customer || undefined;
  }

  async getCustomersByExactName(name: string): Promise<Customer[]> {
    const trimmed = name.trim();
    if (!trimmed) {
      return [];
    }

    return await db
      .select()
      .from(customers)
      .where(sql`lower(${customers.name}) = lower(${trimmed})`);
  }

  async getVehicles(): Promise<Vehicle[]> {
    return await db.select().from(vehicles).orderBy(desc(vehicles.createdAt));
  }

  async getVehicle(id: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle || undefined;
  }

  async getVehicleByPlate(plateNumber: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(ilike(vehicles.plateNumber, plateNumber));
    return vehicle || undefined;
  }

  async getVehiclesByCustomer(customerId: number): Promise<Vehicle[]> {
    return await db.select().from(vehicles).where(eq(vehicles.customerId, customerId));
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [newVehicle] = await db.insert(vehicles).values(vehicle).returning();
    return newVehicle;
  }

  async updateVehicle(id: number, vehicle: InsertVehicle): Promise<Vehicle | undefined> {
    const [updated] = await db
      .update(vehicles)
      .set(vehicle)
      .where(eq(vehicles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteVehicle(id: number): Promise<void> {
    await db.delete(vehicles).where(eq(vehicles.id, id));
  }

  async searchVehicleCandidates(term: string, limit = 5): Promise<VehicleWithCustomer[]> {
    const sanitized = term.trim();
    if (!sanitized) {
      return [];
    }

    const normalizedTerm = sanitized.toUpperCase();
    const digitOnlyTerm = sanitized.replace(/\D/g, "");
    const likePatterns = buildFuzzyPatterns(sanitized);
    const digitPatterns = digitOnlyTerm ? buildDigitPatterns(digitOnlyTerm) : [];

  const conditions: SQL[] = [];
    for (const pattern of likePatterns) {
      conditions.push(ilike(vehicles.plateNumber, pattern));
      conditions.push(ilike(vehicles.make, pattern));
      conditions.push(ilike(vehicles.model, pattern));
      conditions.push(ilike(customers.name, pattern));
    }

    for (const pattern of digitPatterns) {
      conditions.push(sql`regexp_replace(${customers.phone}, '\\D', '', 'g') LIKE ${pattern}`);
    }

    const query = db
      .select({ vehicle: vehicles, customer: customers })
      .from(vehicles)
      .leftJoin(customers, eq(vehicles.customerId, customers.id))
      .orderBy(desc(vehicles.createdAt))
      .limit(Math.max(limit, 5) * 6);

    const whereClause = conditions.length > 1 ? or(...conditions) : conditions[0];

    const rawResults = conditions.length
      ? await query.where(whereClause)
      : await query;

    const scored = new Map<number, { record: VehicleWithCustomer; score: number }>();

    for (const entry of rawResults) {
      if (!entry.vehicle) {
        continue;
      }

      const record: VehicleWithCustomer = {
        vehicle: entry.vehicle,
        customer: entry.customer ?? null,
      };

      const score = computeCandidateScore(normalizedTerm, digitOnlyTerm, record);
      const existing = scored.get(record.vehicle.id);

      if (!existing || score > existing.score) {
        scored.set(record.vehicle.id, { record, score });
      }
    }

    return Array.from(scored.values())
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        const aTime = a.record.vehicle.createdAt instanceof Date
          ? a.record.vehicle.createdAt.getTime()
          : 0;
        const bTime = b.record.vehicle.createdAt instanceof Date
          ? b.record.vehicle.createdAt.getTime()
          : 0;
        return bTime - aTime;
      })
      .slice(0, limit)
      .map((entry) => entry.record);
  }

  async getServices(): Promise<Service[]> {
    return await db.select().from(services).orderBy(desc(services.serviceDate));
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service || undefined;
  }

  async getServicesByVehicle(vehicleId: number): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(eq(services.vehicleId, vehicleId))
      .orderBy(desc(services.serviceDate));
  }

  async getServicesByCustomer(customerId: number): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(eq(services.customerId, customerId))
      .orderBy(desc(services.serviceDate));
  }

  async createService(service: InsertService): Promise<Service> {
    const normalizedService: ServiceInsert = {
      ...service,
      laborCost:
        service.laborCost !== undefined && service.laborCost !== null
          ? String(service.laborCost)
          : "0",
      partsCost:
        service.partsCost !== undefined && service.partsCost !== null
          ? String(service.partsCost)
          : "0",
      totalCost:
        service.totalCost !== undefined && service.totalCost !== null
          ? String(service.totalCost)
          : "0",
    };

    const [newService] = await db.insert(services).values(normalizedService).returning();
    return newService;
  }

  async addServiceMedia(mediaEntries: InsertServiceMedia[]): Promise<ServiceMedia[]> {
    if (mediaEntries.length === 0) {
      return [];
    }

    return await db.insert(serviceMedia).values(mediaEntries).returning();
  }

  async getServiceMedia(serviceId: number): Promise<ServiceMedia[]> {
    return await db
      .select()
      .from(serviceMedia)
      .where(eq(serviceMedia.serviceId, serviceId))
      .orderBy(desc(serviceMedia.createdAt));
  }
}

export const storage = new DatabaseStorage();
