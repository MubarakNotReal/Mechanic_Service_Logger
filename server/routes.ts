import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCustomerSchema, insertVehicleSchema, insertServiceSchema } from "@shared/schema";
import { requireAuth, requireRole } from "./middleware";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/customers", requireAuth, async (_req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const customer = await storage.getCustomer(parseInt(req.params.id));
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/customers", requireRole("admin", "mechanic"), async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const existingCustomer = await storage.getCustomerByPhone(validatedData.phone);
      if (existingCustomer) {
        return res.status(400).json({ error: "Customer with this phone number already exists" });
      }
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/customers/:id", requireRole("admin", "mechanic"), async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.updateCustomer(parseInt(req.params.id), validatedData);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/customers/:id", requireRole("admin", "mechanic"), async (req, res) => {
    try {
      await storage.deleteCustomer(parseInt(req.params.id));
      res.sendStatus(204);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/vehicles", requireAuth, async (_req, res) => {
    try {
      const vehicles = await storage.getVehicles();
      res.json(vehicles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/vehicles/:id", requireAuth, async (req, res) => {
    try {
      const vehicle = await storage.getVehicle(parseInt(req.params.id));
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/vehicles/customer/:customerId", requireAuth, async (req, res) => {
    try {
      const vehicles = await storage.getVehiclesByCustomer(parseInt(req.params.customerId));
      res.json(vehicles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/vehicles", requireRole("admin", "mechanic"), async (req, res) => {
    try {
      const validatedData = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.createVehicle(validatedData);
      res.status(201).json(vehicle);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/vehicles/:id", requireRole("admin", "mechanic"), async (req, res) => {
    try {
      const validatedData = insertVehicleSchema.parse(req.body);
      const vehicle = await storage.updateVehicle(parseInt(req.params.id), validatedData);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      res.json(vehicle);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/vehicles/:id", requireRole("admin", "mechanic"), async (req, res) => {
    try {
      await storage.deleteVehicle(parseInt(req.params.id));
      res.sendStatus(204);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/services", requireAuth, async (_req, res) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/services/:id", requireAuth, async (req, res) => {
    try {
      const service = await storage.getService(parseInt(req.params.id));
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json(service);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/services/vehicle/:vehicleId", requireAuth, async (req, res) => {
    try {
      const services = await storage.getServicesByVehicle(parseInt(req.params.vehicleId));
      res.json(services);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/services/customer/:customerId", requireAuth, async (req, res) => {
    try {
      const services = await storage.getServicesByCustomer(parseInt(req.params.customerId));
      res.json(services);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/services", requireRole("admin", "mechanic"), async (req, res) => {
    try {
      const validatedData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(validatedData);
      res.status(201).json(service);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
