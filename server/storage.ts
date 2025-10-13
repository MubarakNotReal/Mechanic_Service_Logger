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
import { eq, or, like, ilike, desc } from "drizzle-orm";
import session from "express-session";
import { pool } from "./db";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

type ServiceInsert = typeof services.$inferInsert;

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
  
  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  getVehicleByPlate(plateNumber: string): Promise<Vehicle | undefined>;
  getVehiclesByCustomer(customerId: number): Promise<Vehicle[]>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: InsertVehicle): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<void>;
  
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
    const [user] = await db.select().from(users).where(eq(users.username, username));
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
