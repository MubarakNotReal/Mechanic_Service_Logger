import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Service, InsertService, Customer, Vehicle } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function ServicesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<InsertService>({
    vehicleId: 0,
    customerId: 0,
    serviceDate: new Date(),
    workPerformed: "",
    partsReplaced: "",
    laborCost: "0",
    partsCost: "0",
    totalCost: "0",
    mechanicName: "",
    notes: "",
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const { data: services = [], isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: customers = [], isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertService) => {
      const res = await apiRequest("POST", "/api/services", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Service record created successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create service record", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      vehicleId: 0,
      customerId: 0,
      serviceDate: new Date(),
      workPerformed: "",
      partsReplaced: "",
      laborCost: "0",
      partsCost: "0",
      totalCost: "0",
      mechanicName: "",
      notes: "",
    });
    setSelectedCustomerId(null);
  };

  const customerVehicles = selectedCustomerId
    ? vehicles.filter((v) => v.customerId === selectedCustomerId)
    : [];

  useEffect(() => {
    const labor = parseFloat(formData.laborCost) || 0;
    const parts = parseFloat(formData.partsCost) || 0;
    const total = labor + parts;
    setFormData((prev) => ({ ...prev, totalCost: total.toFixed(2) }));
  }, [formData.laborCost, formData.partsCost]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !formData.vehicleId) {
      toast({ title: "Please select both customer and vehicle", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ...formData,
      customerId: selectedCustomerId,
    });
  };

  const canEdit = user?.role === "admin" || user?.role === "mechanic";

  const sortedServices = [...services].sort(
    (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-services-title">Services</h1>
          <p className="text-muted-foreground">Create and view service records</p>
        </div>
        {canEdit && (
          <Button onClick={() => setDialogOpen(true)} data-testid="button-add-service">
            <Plus className="h-4 w-4 mr-2" />
            New Service
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingServices || loadingCustomers || loadingVehicles ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : sortedServices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No service records found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Work Performed</TableHead>
                  <TableHead>Mechanic</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedServices.map((service) => {
                  const vehicle = vehicles.find((v) => v.id === service.vehicleId);
                  const customer = customers.find((c) => c.id === service.customerId);
                  return (
                    <TableRow key={service.id} data-testid={`row-service-${service.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{format(new Date(service.serviceDate), "MMM d, yyyy")}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vehicle ? (
                          <div>
                            <p className="font-medium">
                              {vehicle.make} {vehicle.model}
                            </p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {vehicle.plateNumber}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {customer ? (
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-sm text-muted-foreground font-mono">{customer.phone}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="max-w-xs truncate">{service.workPerformed}</p>
                        {service.partsReplaced && (
                          <p className="text-sm text-muted-foreground">Parts: {service.partsReplaced}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {service.mechanicName || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{parseFloat(service.totalCost).toFixed(2)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Service Record</DialogTitle>
            <DialogDescription>Enter service details and cost information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select
                  value={selectedCustomerId?.toString() || ""}
                  onValueChange={(value) => {
                    setSelectedCustomerId(parseInt(value));
                    setFormData({ ...formData, vehicleId: 0 });
                  }}
                >
                  <SelectTrigger id="customer" data-testid="select-service-customer">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name} ({customer.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle *</Label>
                <Select
                  value={formData.vehicleId.toString()}
                  onValueChange={(value) => setFormData({ ...formData, vehicleId: parseInt(value) })}
                  disabled={!selectedCustomerId}
                >
                  <SelectTrigger id="vehicle" data-testid="select-service-vehicle">
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                        {vehicle.plateNumber} - {vehicle.make} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceDate">Service Date *</Label>
              <Input
                id="serviceDate"
                type="date"
                value={format(new Date(formData.serviceDate), "yyyy-MM-dd")}
                onChange={(e) => setFormData({ ...formData, serviceDate: new Date(e.target.value) })}
                required
                data-testid="input-service-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workPerformed">Work Performed *</Label>
              <Textarea
                id="workPerformed"
                value={formData.workPerformed}
                onChange={(e) => setFormData({ ...formData, workPerformed: e.target.value })}
                rows={3}
                placeholder="Describe the work performed..."
                required
                data-testid="input-work-performed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partsReplaced">Parts Replaced</Label>
              <Textarea
                id="partsReplaced"
                value={formData.partsReplaced}
                onChange={(e) => setFormData({ ...formData, partsReplaced: e.target.value })}
                rows={2}
                placeholder="List parts that were replaced..."
                data-testid="input-parts-replaced"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="laborCost">Labor Cost *</Label>
                <Input
                  id="laborCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.laborCost}
                  onChange={(e) => setFormData({ ...formData, laborCost: e.target.value })}
                  required
                  data-testid="input-labor-cost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partsCost">Parts Cost *</Label>
                <Input
                  id="partsCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.partsCost}
                  onChange={(e) => setFormData({ ...formData, partsCost: e.target.value })}
                  required
                  data-testid="input-parts-cost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalCost">Total Cost</Label>
                <Input
                  id="totalCost"
                  type="number"
                  step="0.01"
                  value={formData.totalCost}
                  readOnly
                  className="bg-muted"
                  data-testid="input-total-cost"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mechanicName">Mechanic Name</Label>
              <Input
                id="mechanicName"
                value={formData.mechanicName}
                onChange={(e) => setFormData({ ...formData, mechanicName: e.target.value })}
                placeholder="Enter mechanic name..."
                data-testid="input-mechanic-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes..."
                data-testid="input-service-notes"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel-service"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-submit-service"
              >
                {createMutation.isPending ? "Creating..." : "Create Service Record"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
