import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, numeric, timestamp, pgEnum, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum for user roles
export const userRoleEnum = pgEnum("user_role", ["admin", "mechanic", "viewer"]);

// Enum for service status lifecycle
export const serviceStatusEnum = pgEnum("service_status", ["scheduled", "in_progress", "completed", "closed"]);


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
  status: serviceStatusEnum("status").notNull().default("completed"),
  odometer: integer("odometer"),
  nextServiceDue: timestamp("next_service_due"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const serviceMedia = pgTable("service_media", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  relativePath: text("relative_path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Session table used by connect-pg-simple for Express sessions
export const session = pgTable("session", {
  sid: varchar("sid", { length: 255 }).primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// Payments table - tracks invoices and receipts per service
// Service line items table - granular record of parts/labor per service visit
export const serviceItems = pgTable("service_items", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  partNumber: text("part_number"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  laborHours: numeric("labor_hours", { precision: 10, scale: 2 }).notNull().default("0"),
  laborRate: numeric("labor_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Maintenance reminders table - optional follow-up reminders for customers/vehicles
export const maintenanceReminders = pgTable("maintenance_reminders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  vehicleId: integer("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date").notNull(),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

export const servicesRelations = relations(services, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [services.vehicleId],
    references: [vehicles.id],
  }),
  customer: one(customers, {
    fields: [services.customerId],
    references: [customers.id],
  }),
  media: many(serviceMedia),
}));

export const serviceMediaRelations = relations(serviceMedia, ({ one }) => ({
  service: one(services, {
    fields: [serviceMedia.serviceId],
    references: [services.id],
  }),
}));

export const serviceItemsRelations = relations(serviceItems, ({ one }) => ({
  service: one(services, {
    fields: [serviceItems.serviceId],
    references: [services.id],
  }),
}));

export const maintenanceRemindersRelations = relations(maintenanceReminders, ({ one }) => ({
  customer: one(customers, {
    fields: [maintenanceReminders.customerId],
    references: [customers.id],
  }),
  vehicle: one(vehicles, {
    fields: [maintenanceReminders.vehicleId],
    references: [vehicles.id],
  }),
  createdByUser: one(users, {
    fields: [maintenanceReminders.createdBy],
    references: [users.id],
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
  updatedAt: true,
}).extend({
  serviceDate: z.coerce.date(),
  workPerformed: z.string().min(1, "Work performed description is required"),
  laborCost: z.string().or(z.number()).optional(),
  partsCost: z.string().or(z.number()).optional(),
  totalCost: z.string().or(z.number()).optional(),
  status: z.enum(serviceStatusEnum.enumValues).optional(),
  odometer: z.number().int().min(0).optional(),
  nextServiceDue: z.coerce.date().optional(),
  createdBy: z.string().uuid().optional(),
});

export const insertServiceItemSchema = createInsertSchema(serviceItems).omit({
  id: true,
  createdAt: true,
}).extend({
  description: z.string().min(1, "Item description is required"),
});

export const insertMaintenanceReminderSchema = createInsertSchema(maintenanceReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  title: z.string().min(1, "Reminder title is required"),
  dueDate: z.coerce.date(),
  completed: z.boolean().optional(),
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

export type InsertServiceItem = z.infer<typeof insertServiceItemSchema>;
export type ServiceItem = typeof serviceItems.$inferSelect;

export type InsertMaintenanceReminder = z.infer<typeof insertMaintenanceReminderSchema>;
export type MaintenanceReminder = typeof maintenanceReminders.$inferSelect;

export type InsertServiceMedia = typeof serviceMedia.$inferInsert;
export type ServiceMedia = typeof serviceMedia.$inferSelect;

export type Session = typeof session.$inferSelect;
