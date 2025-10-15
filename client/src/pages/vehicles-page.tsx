import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocation } from "wouter";
import {
  AlertCircle,
  Calendar,
  Car,
  DollarSign,
  Loader2,
  Plus,
  Search,
  User,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Customer, Service, Vehicle } from "@shared/schema";

type LookupResult = {
  vehicle: Vehicle;
  customer: Customer | null;
  services: Service[];
};

type LookupError = Error & { status?: number };

type RegistrationFormState = {
  customerName: string;
  phone: string;
  plateNumber: string;
  make: string;
  model: string;
  year: string;
};

type RegistrationResult = {
  customer: Customer;
  vehicle: Vehicle;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "SAR",
  minimumFractionDigits: 2,
});
function sortServicesByDate(entries: Service[]): Service[] {
  return [...entries].sort(
    (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime(),
  );
}

export default function VehiclesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentLocation, setLocation] = useLocation();

  const [plateInput, setPlateInput] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationForm, setRegistrationForm] = useState<RegistrationFormState>(() => ({
    customerName: "",
    phone: "",
    plateNumber: "",
    make: "",
    model: "",
    year: String(new Date().getFullYear()),
  }));

  const [initializedPlate, setInitializedPlate] = useState<string | null>(null);
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);

  const canEdit = user?.role === "admin" || user?.role === "mechanic";

  const lookupMutation = useMutation<LookupResult, LookupError, string>({
    mutationFn: async (plate) => {
      const normalizedPlate = plate.trim().toUpperCase();
      const res = await fetch(`/api/vehicles/lookup/${encodeURIComponent(normalizedPlate)}`, {
        credentials: "include",
      });

      if (res.status === 404) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const error = new Error(body.error ?? "Vehicle not found");
        (error as LookupError).status = 404;
        throw error;
      }

      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        const error = new Error(text);
        (error as LookupError).status = res.status;
        throw error;
      }

      const payload = (await res.json()) as LookupResult;
      return { ...payload, services: sortServicesByDate(payload.services) };
    },
    onMutate: () => {
      setLookupError(null);
      setNotFound(false);
      setLookupResult(null);
    },
    onSuccess: (data, plate) => {
      setLookupResult(data);
      setNotFound(false);
      setLookupError(null);
      setRegistrationForm((prev) => ({
        ...prev,
        plateNumber: data.vehicle.plateNumber,
      }));
      setPlateInput(plate);
      setInitializedPlate(data.vehicle.plateNumber);
      setLocation(`/?plate=${encodeURIComponent(data.vehicle.plateNumber)}`, { replace: true });
    },
    onError: (error, plate) => {
      if (error.status === 404) {
        setNotFound(true);
        setLookupResult(null);
        setRegistrationForm((prev) => ({
          ...prev,
          plateNumber: plate.trim().toUpperCase(),
        }));
        const normalized = plate.trim().toUpperCase();
        setInitializedPlate(normalized);
        setLocation(`/?plate=${encodeURIComponent(normalized)}`, { replace: true });
        return;
      }

      setLookupError(error.message || "Failed to search for vehicle");
    },
  });

  const registerMutation = useMutation<RegistrationResult, Error, RegistrationFormState>({
    mutationFn: async (form) => {
      const normalizedPlate = form.plateNumber.trim().toUpperCase();
      if (!normalizedPlate) {
        throw new Error("Plate number is required");
      }

      const customerPayload = {
        name: form.customerName.trim(),
        phone: form.phone.trim(),
        notes: "",
      } as const;

      const customerRes = await apiRequest("POST", "/api/customers", customerPayload);
      const customer = (await customerRes.json()) as Customer;

      const vehiclePayload = {
        customerId: customer.id,
        plateNumber: normalizedPlate,
        make: form.make.trim(),
        model: form.model.trim(),
        year: Number.parseInt(form.year, 10) || new Date().getFullYear(),
      } satisfies Partial<Vehicle>;

      const vehicleRes = await apiRequest("POST", "/api/vehicles", vehiclePayload);
      const vehicle = (await vehicleRes.json()) as Vehicle;

      return { customer, vehicle };
    },
    onMutate: () => {
      setRegistrationError(null);
    },
    onSuccess: ({ customer, vehicle }) => {
      setLookupResult({
        vehicle,
        customer,
        services: [],
      });
      setNotFound(false);
      setPlateInput(vehicle.plateNumber);
      setInitializedPlate(vehicle.plateNumber);
      setRegistrationDialogOpen(false);
      setRegistrationForm((prev) => ({
        ...prev,
        customerName: "",
        phone: "",
        plateNumber: vehicle.plateNumber,
        make: "",
        model: "",
        year: String(new Date().getFullYear()),
      }));
      toast({ title: "Vehicle registered", description: "You can now add service records." });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setLocation(`/?plate=${encodeURIComponent(vehicle.plateNumber)}`, { replace: true });
    },
    onError: (error) => {
      setRegistrationError(error.message || "Failed to register vehicle");
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { mutate: lookupMutate, isPending: isLookupPending } = lookupMutation;

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedPlate = plateInput.trim().toUpperCase();
    if (!normalizedPlate) {
      setLookupError("Plate number is required");
      return;
    }

    setLookupError(null);
    setNotFound(false);
    setInitializedPlate(normalizedPlate);
    lookupMutate(normalizedPlate);
  };

  const handleRegistrationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    registerMutation.mutate({ ...registrationForm });
  };

  const openRegistrationDialog = () => {
    setRegistrationForm((prev) => ({
      ...prev,
      plateNumber: plateInput.trim().toUpperCase() || prev.plateNumber,
    }));
    setRegistrationError(null);
    setRegistrationDialogOpen(true);
  };

  const closeRegistrationDialog = () => {
    if (registerMutation.isPending) {
      return;
    }

    setRegistrationError(null);
    setRegistrationDialogOpen(false);
  };

  const renderRegistrationForm = (
    options: {
      onCancel?: () => void;
      submitLabel?: string;
    } = {},
  ) => (
    <form onSubmit={handleRegistrationSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer name *</Label>
            <Input
              id="customerName"
              value={registrationForm.customerName}
              onChange={(event) =>
                setRegistrationForm((prev) => ({ ...prev, customerName: event.target.value }))
              }
              placeholder="Full name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              type="tel"
              value={registrationForm.phone}
              onChange={(event) =>
                setRegistrationForm((prev) => ({ ...prev, phone: event.target.value }))
              }
              placeholder="Contact number"
              required
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Vehicle details</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="plateNumber">Plate number *</Label>
            <Input
              id="plateNumber"
              value={registrationForm.plateNumber}
              onChange={(event) =>
                setRegistrationForm((prev) => ({
                  ...prev,
                  plateNumber: event.target.value.toUpperCase(),
                }))
              }
              className="uppercase font-mono"
              placeholder="ABC-1234"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-year">Year *</Label>
            <Input
              id="reg-year"
              type="number"
              min="1900"
              max={new Date().getFullYear() + 1}
              value={registrationForm.year}
              onChange={(event) =>
                setRegistrationForm((prev) => ({ ...prev, year: event.target.value }))
              }
              required
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="make">Make *</Label>
            <Input
              id="make"
              value={registrationForm.make}
              onChange={(event) =>
                setRegistrationForm((prev) => ({ ...prev, make: event.target.value }))
              }
              placeholder="Manufacturer"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Model *</Label>
            <Input
              id="model"
              value={registrationForm.model}
              onChange={(event) =>
                setRegistrationForm((prev) => ({ ...prev, model: event.target.value }))
              }
              placeholder="Model name"
              required
            />
          </div>
        </div>
      </div>

      {registrationError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{registrationError}</span>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {options.onCancel && (
          <Button type="button" variant="outline" onClick={options.onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Registering
            </>
          ) : (
            options.submitLabel ?? "Register vehicle"
          )}
        </Button>
      </div>
    </form>
  );

  const goToNewService = () => {
    if (!lookupResult?.vehicle) {
      return;
    }

    setLocation(`/services/new?plate=${encodeURIComponent(lookupResult.vehicle.plateNumber)}`);
  };

  const openServiceDetail = (serviceId: number) => {
    setLocation(`/services/${serviceId}`);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const plateParam = searchParams.get("plate");

    if (!plateParam) {
      setInitializedPlate(null);
      return;
    }

    const normalizedPlate = plateParam.trim().toUpperCase();
    if (!normalizedPlate) {
      return;
    }

    setPlateInput((prev) => (prev === normalizedPlate ? prev : normalizedPlate));

    if (isLookupPending) {
      return;
    }

    if (lookupResult && lookupResult.vehicle.plateNumber === normalizedPlate) {
      return;
    }

    if (initializedPlate === normalizedPlate && notFound) {
      return;
    }

    if (initializedPlate !== normalizedPlate) {
      setInitializedPlate(normalizedPlate);
    }

    lookupMutate(normalizedPlate);
  }, [currentLocation, initializedPlate, isLookupPending, lookupMutate, lookupResult, notFound]);

  const isLoadingLookup = isLookupPending;
  const hasLookupResult = Boolean(lookupResult);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vehicle search</h1>
        <p className="text-muted-foreground">
          Look up vehicles by plate number, review their history, and register new customers when needed.
        </p>
      </div>

      <Dialog
        open={registrationDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            openRegistrationDialog();
          } else {
            closeRegistrationDialog();
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Register a new vehicle</DialogTitle>
            <DialogDescription>
              Capture the owner and vehicle details below to add a new vehicle to the system.
            </DialogDescription>
          </DialogHeader>
          {renderRegistrationForm({ onCancel: closeRegistrationDialog })}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-col gap-2 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Search by plate number</CardTitle>
            <CardDescription>Type a plate number to load vehicle, owner, and service history.</CardDescription>
          </div>
          {canEdit && (
            <Button onClick={openRegistrationDialog} className="whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" />
              Register vehicle
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:px-6 sm:pb-6">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="plate-search">Plate number</Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="plate-search"
                  value={plateInput}
                  onChange={(event) => setPlateInput(event.target.value.toUpperCase())}
                  placeholder="e.g. ABC-1234"
                  className="uppercase font-mono"
                  required
                />
                <Button type="submit" disabled={isLoadingLookup} className="whitespace-nowrap">
                  {isLoadingLookup ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
          {lookupError && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{lookupError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoadingLookup && (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-6">
            {[1, 2].map((key) => (
              <Skeleton key={key} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {hasLookupResult && lookupResult && (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-4 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Car className="h-5 w-5 text-muted-foreground" />
                  {lookupResult.vehicle.make} {lookupResult.vehicle.model} ({lookupResult.vehicle.year})
                </CardTitle>
                <Badge variant="outline" className="w-fit font-mono text-base">
                  {lookupResult.vehicle.plateNumber}
                </Badge>
              </div>
              {canEdit && (
                <Button onClick={goToNewService}>
                  <Plus className="mr-2 h-4 w-4" />
                  New service
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6 p-4 pt-0 sm:px-6 sm:pb-6">
              <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">Vehicle details</h3>
                  <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {format(new Date(lookupResult.vehicle.createdAt), "PPP")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Vehicle ID</p>
                      <p className="font-medium">#{lookupResult.vehicle.id}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">Owner</h3>
                  {lookupResult.customer ? (
                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-muted p-2">
                          <User className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold">{lookupResult.customer.name}</p>
                          <p className="text-xs text-muted-foreground">Customer #{lookupResult.customer.id}</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Phone</span>
                          <span className="font-mono">{lookupResult.customer.phone}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Email</span>
                          <span>{lookupResult.customer.email || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">Address</span>
                          <span className="text-right">
                            {lookupResult.customer.address || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Owner details are missing for this vehicle.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-lg font-semibold">Service history</h3>
                  <span className="text-sm text-muted-foreground">
                    {lookupResult.services.length} record{lookupResult.services.length === 1 ? "" : "s"}
                  </span>
                </div>
                {lookupResult.services.length === 0 ? (
                  <div className="mt-4 rounded-lg border py-12 text-center text-muted-foreground">
                    No services recorded for this vehicle yet.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 hidden overflow-x-auto rounded-lg border md:block">
                      <Table className="min-w-[640px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Work performed</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lookupResult.services.map((service) => (
                            <TableRow
                              key={service.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => openServiceDetail(service.id)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span>{format(new Date(service.serviceDate), "PPP")}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Wrench className="h-4 w-4 text-muted-foreground" />
                                  <span className="truncate max-w-sm">{service.workPerformed}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="capitalize">
                                  {service.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-semibold">
                                    {currencyFormatter.format(
                                      Number.parseFloat(String(service.totalCost ?? "0")) || 0,
                                    )}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 space-y-4 md:hidden">
                      {lookupResult.services.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          className="w-full rounded-lg border p-4 text-left transition hover:border-primary/40 hover:bg-muted/40"
                          onClick={() => openServiceDetail(service.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-muted-foreground">{format(new Date(service.serviceDate), "PPP")}</span>
                            <Badge variant="secondary" className="capitalize">
                              {service.status}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-start gap-2">
                            <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm text-foreground">{service.workPerformed}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total cost</span>
                            <span className="flex items-center gap-1 font-semibold">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              {currencyFormatter.format(
                                Number.parseFloat(String(service.totalCost ?? "0")) || 0,
                              )}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

        </>
      )}

      {!hasLookupResult && notFound && (
        <Card>
          <CardHeader>
            <CardTitle>Register a new vehicle</CardTitle>
            <CardDescription>
              No vehicle matched this plate. Capture the owner and vehicle details to register it now.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderRegistrationForm({
              onCancel: () => {
                setRegistrationError(null);
                setNotFound(false);
              },
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
