import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum for user roles
export const userRoleEnum = pgEnum("user_role", ["admin", "mechanic", "viewer"]);

// Users table - for authentication with role-based access
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("viewer"),
  name: text("name").notNull(),
});

// Customers table - phone number as unique identifier
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Vehicles table - linked to customers
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  plateNumber: text("plate_number").notNull().unique(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Services table - repair and service history
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  serviceDate: timestamp("service_date").notNull().defaultNow(),
  workPerformed: text("work_performed").notNull(),
  partsReplaced: text("parts_replaced"),
  laborCost: numeric("labor_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  partsCost: numeric("parts_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  mechanicName: text("mechanic_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Define relations
export const customersRelations = relations(customers, ({ many }) => ({
  vehicles: many(vehicles),
  services: many(services),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  customer: one(customers, {
    fields: [vehicles.customerId],
    references: [customers.id],
  }),
  services: many(services),
}));

export const servicesRelations = relations(services, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [services.vehicleId],
    references: [vehicles.id],
  }),
  customer: one(customers, {
    fields: [services.customerId],
    references: [customers.id],
  }),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  name: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
}).extend({
  phone: z.string().min(1, "Phone number is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  createdAt: true,
}).extend({
  plateNumber: z.string().min(1, "Plate number is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().min(1900).max(new Date().getFullYear() + 1),
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
}).extend({
  workPerformed: z.string().min(1, "Work performed description is required"),
  laborCost: z.string().or(z.number()),
  partsCost: z.string().or(z.number()),
  totalCost: z.string().or(z.number()),
});

// TypeScript types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;
