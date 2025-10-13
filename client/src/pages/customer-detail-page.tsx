import { useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Calendar, DollarSign, Wrench } from "lucide-react";
import { format } from "date-fns";
import type { Customer, Service, Vehicle } from "@shared/schema";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export default function CustomerDetailPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/customers/:id");

  const customerId = useMemo(() => {
    const raw = params?.id;
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }, [params?.id]);

  const {
    data: customer,
    isLoading: loadingCustomer,
    error: customerError,
  } = useQuery<Customer>({
    queryKey: ["/api/customers", customerId?.toString() ?? ""],
    enabled: match && customerId !== null,
  });

  const {
    data: services = [],
    isLoading: loadingServices,
    error: servicesError,
  } = useQuery<Service[]>({
    queryKey: ["/api/services/customer", customerId?.toString() ?? ""],
    enabled: match && customerId !== null,
  });

  const {
    data: vehicles = [],
    isLoading: loadingVehicles,
    error: vehiclesError,
  } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles/customer", customerId?.toString() ?? ""],
    enabled: match && customerId !== null,
  });

  useEffect(() => {
    if (!match || customerId === null) {
      setLocation("/customers");
    }
  }, [match, customerId, setLocation]);

  if (!match || customerId === null) {
    return null;
  }

  const isLoading = loadingCustomer || loadingServices || loadingVehicles;
  const errorMessage = customerError?.message || servicesError?.message || vehiclesError?.message;
  const vehiclesById = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => setLocation("/customers")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to customers
        </Button>
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-customer-detail-title">
            Customer details
          </h1>
          <p className="text-muted-foreground">Review service history, vehicles, and contacts</p>
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
            <p className="text-sm text-destructive">Failed to load customer: {errorMessage}</p>
          </CardContent>
        </Card>
      ) : customer ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{customer.name}</span>
                <Badge variant="outline">#{customer.id}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium" data-testid="text-customer-detail-phone">
                  {customer.phone}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium" data-testid="text-customer-detail-email">
                  {customer.email || "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium" data-testid="text-customer-detail-address">
                  {customer.address || "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="font-medium" data-testid="text-customer-detail-notes">
                  {customer.notes || "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vehicles</CardTitle>
            </CardHeader>
            <CardContent>
              {vehicles.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  This customer does not have any vehicles on file.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {vehicles.map((vehicle) => (
                    <Card key={vehicle.id} className="border-muted">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span className="font-semibold">
                            {vehicle.make} {vehicle.model}
                          </span>
                          <Badge variant="secondary">{vehicle.plateNumber}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Year</span>
                          <span className="font-medium">{vehicle.year}</span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Created</span>
                          <span className="font-medium">
                            {format(new Date(vehicle.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service history</CardTitle>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  This customer does not have any recorded service visits yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Work performed</TableHead>
                      <TableHead>Vehicle</TableHead>
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
                          const vehicle = vehiclesById.get(service.vehicleId);
                          const query = vehicle
                            ? `?plate=${encodeURIComponent(vehicle.plateNumber)}`
                            : "";
                          setLocation(`/services/${service.id}${query}`);
                        }}
                        data-testid={`row-customer-service-${service.id}`}
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
                            <span className="truncate max-w-sm">{service.workPerformed}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const vehicle = vehiclesById.get(service.vehicleId);
                            if (!vehicle) {
                              return <span className="text-muted-foreground">Unknown vehicle</span>;
                            }
                            return (
                              <div>
                                <p className="font-medium">
                                  {vehicle.make} {vehicle.model}
                                </p>
                                <p className="text-sm text-muted-foreground font-mono">
                                  {vehicle.plateNumber}
                                </p>
                              </div>
                            );
                          })()}
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
                              {currencyFormatter.format(Number.parseFloat(String(service.totalCost)) || 0)}
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
        </>
      ) : null}
    </div>
  );
}
