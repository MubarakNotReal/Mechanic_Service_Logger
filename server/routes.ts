import type { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import {
  insertCustomerSchema,
  insertVehicleSchema,
  insertServiceSchema,
  type Customer,
  type Vehicle,
  type Service,
} from "@shared/schema";
import { requireAuth, requireRole } from "./middleware";

const MEDIA_UPLOAD_LIMIT = 10;
const MAX_MEDIA_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const uploadRoot = path.resolve(process.cwd(), "uploads");
const serviceMediaDir = path.join(uploadRoot, "service-media");
const VEHICLE_SUGGESTION_LIMIT = 5;

type SuggestionReason = "plate" | "phone" | "name" | "vehicle" | "partial";

type LookupPayload = {
  vehicle: Vehicle;
  customer: Customer | null;
  services: Service[];
};

type SuggestionPayload = {
  vehicle: Vehicle;
  customer: Customer | null;
  reason: SuggestionReason;
};

const mediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdir(serviceMediaDir, { recursive: true })
      .then(() => cb(null, serviceMediaDir))
      .catch((error) => cb(error as Error, serviceMediaDir));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${uniqueSuffix}-${sanitized}`);
  },
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: {
    fileSize: MAX_MEDIA_FILE_SIZE_BYTES,
    files: MEDIA_UPLOAD_LIMIT,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
  const error = new Error("Only image and video uploads are supported");
  (error as any).status = 400;
  cb(error);
    }
  },
});

function toRelativeMediaPath(absolutePath: string): string {
  return path.relative(uploadRoot, absolutePath).split(path.sep).join("/");
}

async function cleanupUploadedFiles(files?: Express.Multer.File[]) {
  if (!files || files.length === 0) {
    return;
  }

  await Promise.all(
    files.map((file) =>
      fs.unlink(file.path).catch(() => {
        /* ignore cleanup errors */
      }),
    ),
  );
}

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const normalizePhoneDigits = (value: string): string => value.replace(/\D/g, "");

const hasLetters = (value: string): boolean => /[a-zA-Z]/.test(value);

const hasDigits = (value: string): boolean => /\d/.test(value);

const isLikelyPlate = (value: string): boolean => {
  const compact = value.replace(/\s+/g, "");
  return compact.length >= 4 && hasLetters(compact) && hasDigits(compact);
};

async function buildLookupPayload(vehicle: Vehicle): Promise<LookupPayload> {
  const [customer, services] = await Promise.all([
    storage.getCustomer(vehicle.customerId),
    storage.getServicesByVehicle(vehicle.id),
  ]);

  return {
    vehicle,
    customer: customer ?? null,
    services,
  };
}

function determineSuggestionReason(
  normalizedTerm: string,
  digitsOnly: string,
  candidate: Vehicle,
  customer: Customer | null,
): SuggestionReason {
  const upperTerm = normalizedTerm.toUpperCase();
  const plateUpper = candidate.plateNumber.toUpperCase();

  if (upperTerm && plateUpper.includes(upperTerm)) {
    return "plate";
  }

  if (digitsOnly && customer?.phone) {
    const customerDigits = normalizePhoneDigits(customer.phone);
    if (customerDigits.includes(digitsOnly)) {
      return "phone";
    }
  }

  if (upperTerm && customer?.name && customer.name.toUpperCase().includes(upperTerm)) {
    return "name";
  }

  if (
    upperTerm &&
    (candidate.make.toUpperCase().includes(upperTerm) || candidate.model.toUpperCase().includes(upperTerm))
  ) {
    return "vehicle";
  }

  return "partial";
}

async function resolvePrimaryMatch(term: string): Promise<{
  match: LookupPayload | null;
  seedSuggestions: SuggestionPayload[];
}> {
  const normalizedTerm = normalizeWhitespace(term);
  const uppercaseTerm = normalizedTerm.toUpperCase();
  const digitsOnly = normalizePhoneDigits(normalizedTerm);
  const seedSuggestions: SuggestionPayload[] = [];

  if (normalizedTerm && isLikelyPlate(normalizedTerm)) {
    const vehicle = await storage.getVehicleByPlate(uppercaseTerm);
    if (vehicle) {
      return { match: await buildLookupPayload(vehicle), seedSuggestions };
    }
  }

  if (digitsOnly.length >= 7) {
    const customer = await storage.getCustomerByNormalizedPhone(digitsOnly);
    if (customer) {
      const vehiclesForCustomer = await storage.getVehiclesByCustomer(customer.id);
      if (vehiclesForCustomer.length === 1) {
        return {
          match: await buildLookupPayload(vehiclesForCustomer[0]),
          seedSuggestions,
        };
      }

      for (const vehicle of vehiclesForCustomer) {
        seedSuggestions.push({
          vehicle,
          customer,
          reason: "phone",
        });
      }
    }
  }

  if (normalizedTerm) {
    const customersByName = await storage.getCustomersByExactName(normalizedTerm);
    if (customersByName.length === 1) {
      const singleCustomer = customersByName[0];
      const vehiclesForCustomer = await storage.getVehiclesByCustomer(singleCustomer.id);
      if (vehiclesForCustomer.length === 1) {
        return {
          match: await buildLookupPayload(vehiclesForCustomer[0]),
          seedSuggestions,
        };
      }

      for (const vehicle of vehiclesForCustomer) {
        seedSuggestions.push({
          vehicle,
          customer: singleCustomer,
          reason: "name",
        });
      }
    } else if (customersByName.length > 1) {
      for (const customer of customersByName) {
        const vehiclesForCustomer = await storage.getVehiclesByCustomer(customer.id);
        for (const vehicle of vehiclesForCustomer) {
          seedSuggestions.push({
            vehicle,
            customer,
            reason: "name",
          });
        }
      }
    }
  }

  return { match: null, seedSuggestions };
}

async function buildSuggestions(
  term: string,
  matchVehicleId: number | undefined,
  seeds: SuggestionPayload[] = [],
): Promise<SuggestionPayload[]> {
  const normalizedTerm = normalizeWhitespace(term);
  const digitsOnly = normalizePhoneDigits(normalizedTerm);
  const candidateLimit = Math.max(VEHICLE_SUGGESTION_LIMIT, seeds.length);

  const accumulator = new Map<number, SuggestionPayload>();
  for (const suggestion of seeds) {
    if (matchVehicleId && suggestion.vehicle.id === matchVehicleId) {
      continue;
    }
    if (!accumulator.has(suggestion.vehicle.id)) {
      accumulator.set(suggestion.vehicle.id, suggestion);
    }
  }

  const fetchedCandidates = await storage.searchVehicleCandidates(normalizedTerm, candidateLimit * 2);
  for (const candidate of fetchedCandidates) {
    const vehicle = candidate.vehicle;
    if (!vehicle) {
      continue;
    }

    if (matchVehicleId && vehicle.id === matchVehicleId) {
      continue;
    }

    if (accumulator.has(vehicle.id)) {
      continue;
    }

    const customer = candidate.customer ?? null;
    const reason = determineSuggestionReason(normalizedTerm, digitsOnly, vehicle, customer);
    accumulator.set(vehicle.id, {
      vehicle,
      customer,
      reason,
    });

    if (accumulator.size >= VEHICLE_SUGGESTION_LIMIT) {
      break;
    }
  }

  return Array.from(accumulator.values()).slice(0, VEHICLE_SUGGESTION_LIMIT);
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  await fs.mkdir(serviceMediaDir, { recursive: true });

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

  app.get("/api/vehicles/search", requireAuth, async (req, res) => {
    const rawQuery =
      typeof req.query.query === "string"
        ? req.query.query
        : typeof req.query.q === "string"
          ? req.query.q
          : "";

    const searchTerm = normalizeWhitespace(rawQuery);

    if (!searchTerm) {
      return res.status(400).json({ error: "Search term is required" });
    }

    try {
      const { match, seedSuggestions } = await resolvePrimaryMatch(searchTerm);
      const suggestions = await buildSuggestions(searchTerm, match?.vehicle.id, seedSuggestions);

      res.json({
        match,
        suggestions,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message ?? "Vehicle search failed" });
    }
  });

  app.get("/api/vehicles/lookup/:plate", requireAuth, async (req, res) => {
    const rawPlate = req.params.plate ?? "";
    const plateNumber = rawPlate.trim();

    if (!plateNumber) {
      return res.status(400).json({ error: "Plate number is required" });
    }

    try {
      const vehicle = await storage.getVehicleByPlate(plateNumber.toUpperCase());

      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      const customer = await storage.getCustomer(vehicle.customerId);
      const services = await storage.getServicesByVehicle(vehicle.id);

      res.json({
        vehicle,
        customer: customer ?? null,
        services,
      });
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

  app.get("/api/services/:id/media", requireAuth, async (req, res) => {
    try {
      const serviceId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(serviceId)) {
        return res.status(400).json({ error: "Invalid service id" });
      }

      const mediaEntries = await storage.getServiceMedia(serviceId);
      const payload = mediaEntries.map((entry) => ({
        id: entry.id,
        serviceId: entry.serviceId,
        fileName: entry.fileName,
        fileType: entry.fileType,
        fileSize: entry.fileSize,
        url: `/uploads/${entry.relativePath}`,
        createdAt: entry.createdAt,
      }));

      res.json(payload);
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

  app.post(
    "/api/services",
    requireRole("admin", "mechanic"),
    mediaUpload.array("media", MEDIA_UPLOAD_LIMIT),
    async (req, res) => {
      const uploadedFiles = (req.files as Express.Multer.File[]) ?? [];

      try {
        const rawBody = req.body ?? {};
        const plateNumber = rawBody.plateNumber ? String(rawBody.plateNumber).trim().toUpperCase() : "";

        let vehicleId: number | undefined = rawBody.vehicleId;
        let customerId: number | undefined = rawBody.customerId;

        if (plateNumber) {
          const vehicle = await storage.getVehicleByPlate(plateNumber);
          if (!vehicle) {
            await cleanupUploadedFiles(uploadedFiles);
            return res.status(404).json({ error: "Vehicle with this plate number was not found" });
          }

          vehicleId = vehicle.id;
          customerId = vehicle.customerId;
        }

        if (!vehicleId || !customerId) {
          await cleanupUploadedFiles(uploadedFiles);
          return res.status(400).json({ error: "A valid plate number is required to create a service" });
        }

        const payload: Record<string, unknown> = {
          ...rawBody,
          vehicleId,
          customerId,
        };

        delete payload.plateNumber;

        const validatedData = insertServiceSchema.parse(payload);

        const laborCostValue = Number.parseFloat(String(validatedData.laborCost ?? "0")) || 0;
        const partsCostValue = Number.parseFloat(String(validatedData.partsCost ?? "0")) || 0;
        const totalCostValue =
          validatedData.totalCost !== undefined
            ? Number.parseFloat(String(validatedData.totalCost)) || laborCostValue + partsCostValue
            : laborCostValue + partsCostValue;

        const service = await storage.createService({
          ...validatedData,
          laborCost: laborCostValue.toFixed(2),
          partsCost: partsCostValue.toFixed(2),
          totalCost: totalCostValue.toFixed(2),
        });

        if (uploadedFiles.length > 0) {
          await storage.addServiceMedia(
            uploadedFiles.map((file) => ({
              serviceId: service.id,
              fileName: file.originalname,
              fileType: file.mimetype,
              fileSize: file.size,
              relativePath: toRelativeMediaPath(file.path),
            })),
          );
        }

        res.status(201).json(service);
      } catch (error: any) {
        await cleanupUploadedFiles(uploadedFiles);
        res.status(400).json({ error: error.message });
      }
    },
  );

  const httpServer = createServer(app);

  return httpServer;
}
