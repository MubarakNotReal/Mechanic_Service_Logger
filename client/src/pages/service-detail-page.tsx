import { useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Car, ChevronLeft, MapPin, NotebookPen, User } from "lucide-react";
import { format } from "date-fns";
import type { Customer, Service, Vehicle } from "@shared/schema";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

type ServiceMediaEntry = {
  id: number;
  serviceId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  createdAt: string;
};

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const decimals = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
}

export default function ServiceDetailPage() {
  const [currentLocation, setLocation] = useLocation();
  const [match, params] = useRoute("/services/:serviceId");

  const serviceId = useMemo(() => {
    const raw = params?.serviceId;
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [params?.serviceId]);

  const plateFromQuery = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const plate = searchParams.get("plate");
    return plate ? plate.trim().toUpperCase() : null;
  }, [currentLocation]);

  const {
    data: service,
    isLoading: loadingService,
    error: serviceError,
  } = useQuery<Service>({
    queryKey: ["/api/services", serviceId?.toString() ?? ""],
    enabled: match && serviceId !== null,
  });

  const {
    data: vehicle,
    isLoading: loadingVehicle,
    error: vehicleError,
  } = useQuery<Vehicle>({
    queryKey: ["/api/vehicles", service?.vehicleId?.toString() ?? ""],
    enabled: !!service?.vehicleId,
  });

  const {
    data: customer,
    isLoading: loadingCustomer,
    error: customerError,
  } = useQuery<Customer>({
    queryKey: ["/api/customers", service?.customerId?.toString() ?? ""],
    enabled: !!service?.customerId,
  });

  const {
    data: media = [],
    isLoading: loadingMedia,
    error: mediaError,
  } = useQuery<ServiceMediaEntry[]>({
    queryKey: ["/api/services", serviceId?.toString() ?? "", "media"],
    enabled: match && serviceId !== null,
  });

  useEffect(() => {
    if (!match || serviceId === null) {
      if (plateFromQuery) {
        setLocation(`/?plate=${encodeURIComponent(plateFromQuery)}`);
      } else {
        setLocation("/");
      }
    }
  }, [match, serviceId, plateFromQuery, setLocation]);

  if (!match || serviceId === null) {
    return null;
  }

  const isLoading = loadingService || loadingVehicle || loadingCustomer;
  const loadError = serviceError?.message || vehicleError?.message || customerError?.message;
  const backPlate = plateFromQuery ?? vehicle?.plateNumber ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() =>
              backPlate
                ? setLocation(`/?plate=${encodeURIComponent(backPlate)}`)
                : setLocation("/")
            }
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to vehicle
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Service details</h1>
            <p className="text-muted-foreground">Review work history, costs, and related records</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {service && (
            <Badge variant="outline" className="capitalize">
              {service.status}
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-muted rounded" />
              <div className="h-4 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive">Failed to load service: {loadError}</p>
          </CardContent>
        </Card>
      ) : service ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Service #{service.id}</span>
                <span className="text-muted-foreground text-sm">
                  Performed on {format(new Date(service.serviceDate), "PPPP")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="space-y-6">
                <section className="rounded-lg border border-dashed border-muted p-4 text-sm text-muted-foreground">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium truncate">
                        {customer ? customer.name : "Customer record unavailable"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(service.serviceDate), "MMM d, yyyy p")}</span>
                    </div>
                    {service.mechanicName && (
                      <div className="flex items-center gap-2">
                        <NotebookPen className="h-4 w-4" />
                        <span>Mechanic: {service.mechanicName}</span>
                      </div>
                    )}
                    {service.odometer !== null && service.odometer !== undefined && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>Odometer: {service.odometer.toLocaleString()} km</span>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h2 className="text-base font-semibold">Work details</h2>
                  <div className="mt-3 space-y-4 text-sm leading-relaxed">
                    <p className="text-foreground whitespace-pre-line">{service.workPerformed}</p>
                    {service.partsReplaced && (
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          Parts replaced
                        </h3>
                        <p className="whitespace-pre-line text-muted-foreground">{service.partsReplaced}</p>
                      </div>
                    )}
                    {service.notes && (
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          Notes
                        </h3>
                        <p className="whitespace-pre-line text-muted-foreground">{service.notes}</p>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h2 className="text-base font-semibold">Media</h2>
                  <div className="mt-3 text-sm">
                    {loadingMedia ? (
                      <p className="text-muted-foreground">Loading media…</p>
                    ) : mediaError ? (
                      <p className="text-destructive">Failed to load media: {mediaError.message}</p>
                    ) : media.length === 0 ? (
                      <p className="text-muted-foreground">No media attachments for this service.</p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {media.map((entry) => {
                          const isVideo = entry.fileType.startsWith("video/");
                          return (
                            <div key={entry.id} className="overflow-hidden rounded-lg border border-muted">
                              <div className="aspect-video bg-muted">
                                {isVideo ? (
                                  <video
                                    src={entry.url}
                                    controls
                                    preload="metadata"
                                    playsInline
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <img
                                    src={entry.url}
                                    alt={entry.fileName}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-full w-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="border-t p-3 space-y-1">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {entry.fileName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(entry.fileSize)}
                                </p>
                                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                                  <a href={entry.url} target="_blank" rel="noopener noreferrer">
                                    Open file
                                  </a>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div className="flex flex-col gap-6">
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Vehicle
                  </h2>
                  <Card className="mt-3 border-muted">
                    <CardContent className="pt-4 space-y-2 text-sm">
                      {vehicle ? (
                        <>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Car className="h-4 w-4" />
                            <span className="font-medium">
                              {vehicle.make} {vehicle.model} ({vehicle.year})
                            </span>
                          </div>
                          <div className="text-muted-foreground font-mono">
                            Plate: {vehicle.plateNumber}
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground">Vehicle record unavailable.</p>
                      )}
                    </CardContent>
                  </Card>
                </section>

                <section className="mt-auto">
                  <Card className="border-muted shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Cost summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Labor</span>
                        <span className="font-medium">
                          {currencyFormatter.format(Number.parseFloat(String(service.laborCost)) || 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Parts</span>
                        <span className="font-medium">
                          {currencyFormatter.format(Number.parseFloat(String(service.partsCost)) || 0)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">Total</span>
                        <span className="text-lg font-semibold">
                          {currencyFormatter.format(Number.parseFloat(String(service.totalCost)) || 0)}
                        </span>
                      </div>
                      {service.nextServiceDue && (
                        <p className="text-xs text-muted-foreground">
                          Next service due by {format(new Date(service.nextServiceDue), "PPP")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </section>
              </div>
            </CardContent>
          </Card>

          {customer && (
            <Card>
              <CardHeader>
                <CardTitle>Customer summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{customer.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{customer.phone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{customer.email || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium">{customer.address || "—"}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
