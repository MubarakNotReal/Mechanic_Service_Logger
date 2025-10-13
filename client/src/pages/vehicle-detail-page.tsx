import { useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, Car, Calendar, User, Wrench, DollarSign } from "lucide-react";
import type { Vehicle, Service, Customer } from "@shared/schema";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export default function VehicleDetailPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/vehicles/:id");

  const vehicleId = useMemo(() => {
    const raw = params?.id;
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [params?.id]);

  const {
    data: vehicle,
    isLoading: loadingVehicle,
    error: vehicleError,
  } = useQuery<Vehicle>({
    queryKey: ["/api/vehicles", vehicleId?.toString() ?? ""],
    enabled: match && vehicleId !== null,
  });

  const ownerId = vehicle?.customerId ?? null;

  const {
    data: owner,
    isLoading: loadingOwner,
    error: ownerError,
  } = useQuery<Customer>({
    queryKey: ["/api/customers", ownerId?.toString() ?? ""],
    enabled: match && vehicleId !== null && ownerId !== null,
  });

  const {
    data: services = [],
    isLoading: loadingServices,
    error: servicesError,
  } = useQuery<Service[]>({
    queryKey: ["/api/services/vehicle", vehicleId?.toString() ?? ""],
    enabled: match && vehicleId !== null,
  });

  useEffect(() => {
    if (!match || vehicleId === null) {
      setLocation("/vehicles");
    }
  }, [match, vehicleId, setLocation]);

  if (!match || vehicleId === null) {
    return null;
  }

  const isLoading = loadingVehicle || loadingOwner || loadingServices;
  const errorMessage = vehicleError?.message || ownerError?.message || servicesError?.message;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => setLocation("/vehicles")}> 
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to vehicles
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-vehicle-detail-title">
            Vehicle details
          </h1>
          <p className="text-muted-foreground">Review ownership and service history</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : errorMessage ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive">Failed to load vehicle: {errorMessage}</p>
          </CardContent>
        </Card>
      ) : vehicle ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-lg font-semibold">
                  <Car className="h-5 w-5 text-muted-foreground" />
                  {vehicle.make} {vehicle.model} ({vehicle.year})
                </span>
                <Badge variant="outline" className="font-mono text-base">
                  {vehicle.plateNumber}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Vehicle ID</p>
                <p className="font-medium">#{vehicle.id}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Added on</p>
                <p className="font-medium">
                  {format(new Date(vehicle.createdAt), "MMM d, yyyy")}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Service history</CardTitle>
              </CardHeader>
              <CardContent>
                {services.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    No services recorded for this vehicle yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Work performed</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((service) => (
                        <TableRow
                          key={service.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            const query = vehicle
                              ? `?plate=${encodeURIComponent(vehicle.plateNumber)}`
                              : "";
                            setLocation(`/services/${service.id}${query}`);
                          }}
                          data-testid={`row-vehicle-service-${service.id}`}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{format(new Date(service.serviceDate), "MMM d, yyyy")}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Wrench className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate max-w-xs md:max-w-sm">
                                {service.workPerformed}
                              </span>
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
                                  Number.parseFloat(String(service.totalCost)) || 0
                                )}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle>Owner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {owner ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-muted p-2">
                        <User className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold">{owner.name}</p>
                        <p className="text-sm text-muted-foreground">Customer #{owner.id}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="font-medium font-mono">{owner.phone}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium">{owner.email || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Address</span>
                        <span className="text-right font-medium">
                          {owner.address || "—"}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => setLocation(`/customers/${owner.id}`)}
                    >
                      View customer profile
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Owner information unavailable.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
