import { useMemo, useState, type ChangeEvent } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Service, Customer, Vehicle } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const MAX_MEDIA_FILES = 10;

type ServiceFormState = {
  plateNumber: string;
  serviceDate: Date;
  workPerformed: string;
  partsReplaced: string;
  laborCost: string;
  partsCost: string;
  mechanicName: string;
  notes: string;
};

export default function ServicesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ServiceFormState>({
    plateNumber: "",
    serviceDate: new Date(),
    workPerformed: "",
    partsReplaced: "",
    laborCost: "",
    partsCost: "",
    mechanicName: "",
    notes: "",
  });
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  const handleMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setMediaFiles((prev) => {
      const combined = [...prev, ...files];
      const unique = new Map<string, File>();

      for (const file of combined) {
        const key = `${file.name}-${file.lastModified}-${file.size}`;
        if (!unique.has(key)) {
          unique.set(key, file);
        }
      }

      return Array.from(unique.values()).slice(0, MAX_MEDIA_FILES);
    });

    event.target.value = "";
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

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
    mutationFn: async (data: FormData) => {
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
      plateNumber: "",
      serviceDate: new Date(),
      workPerformed: "",
      partsReplaced: "",
      laborCost: "",
      partsCost: "",
      mechanicName: "",
      notes: "",
    });
    setMediaFiles([]);
  };

  const matchedVehicle = useMemo(() => {
    const normalizedPlate = formData.plateNumber.trim().toUpperCase();
    if (!normalizedPlate) {
      return null;
    }

    return (
      vehicles.find((vehicle) => vehicle.plateNumber.toUpperCase() === normalizedPlate) ?? null
    );
  }, [formData.plateNumber, vehicles]);

  const matchedCustomer = useMemo(() => {
    if (!matchedVehicle) {
      return null;
    }

    return customers.find((customer) => customer.id === matchedVehicle.customerId) ?? null;
  }, [matchedVehicle, customers]);

  const derivedTotalCost = useMemo(() => {
    const labor = Number.parseFloat(formData.laborCost || "");
    const parts = Number.parseFloat(formData.partsCost || "");

    const hasLabor = formData.laborCost.trim().length > 0 && Number.isFinite(labor);
    const hasParts = formData.partsCost.trim().length > 0 && Number.isFinite(parts);

    if (!hasLabor && !hasParts) {
      return "";
    }

    const total = (Number.isFinite(labor) ? labor : 0) + (Number.isFinite(parts) ? parts : 0);
    return total.toFixed(2);
  }, [formData.laborCost, formData.partsCost]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedPlate = formData.plateNumber.trim().toUpperCase();

    if (!normalizedPlate) {
      toast({ title: "Please enter a plate number", variant: "destructive" });
      return;
    }

    if (!matchedVehicle) {
      toast({
        title: "Vehicle not found",
        description: "Add the vehicle first before creating a service record.",
        variant: "destructive",
      });
      return;
    }

    const submission = new FormData();
    submission.append("plateNumber", normalizedPlate);
    submission.append("serviceDate", formData.serviceDate.toISOString());
    submission.append("workPerformed", formData.workPerformed);

    if (formData.partsReplaced.trim()) {
      submission.append("partsReplaced", formData.partsReplaced.trim());
    }

    if (formData.laborCost.trim()) {
      submission.append("laborCost", formData.laborCost.trim());
    }

    if (formData.partsCost.trim()) {
      submission.append("partsCost", formData.partsCost.trim());
    }

    if (derivedTotalCost) {
      submission.append("totalCost", derivedTotalCost);
    }

    if (formData.mechanicName.trim()) {
      submission.append("mechanicName", formData.mechanicName.trim());
    }

    if (formData.notes.trim()) {
      submission.append("notes", formData.notes.trim());
    }

    mediaFiles.forEach((file) => {
      submission.append("media", file);
    });

    createMutation.mutate(submission);
  };

  const canEdit = user?.role === "admin" || user?.role === "mechanic";

  const sortedServices = [...services].sort(
    (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold" data-testid="text-services-title">Services</h1>
          <p className="text-muted-foreground">Create and view service records</p>
        </div>
        {canEdit && (
          <Button onClick={() => setDialogOpen(true)} data-testid="button-add-service" className="self-start sm:self-auto">
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
            <div className="overflow-x-auto">
              <Table className="min-w-[720px]">
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
                          <span className="font-semibold">
                            {Number.parseFloat(String(service.totalCost ?? "0")).toFixed(2)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl w-full sm:max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Create Service Record</DialogTitle>
            <DialogDescription>Enter service details and cost information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-1">
              <div className="space-y-2">
                <Label htmlFor="plateNumber">Plate Number *</Label>
                <Input
                  id="plateNumber"
                  value={formData.plateNumber}
                  onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                  placeholder="Type the vehicle plate number"
                  className="uppercase"
                  required
                  data-testid="input-service-plate"
                />
                {formData.plateNumber.trim().length > 0 && (
                  matchedVehicle ? (
                    <div className="rounded-lg border border-muted bg-muted/40 p-3 text-sm space-y-1">
                      <p className="font-semibold">
                        {matchedVehicle.make} {matchedVehicle.model} ({matchedVehicle.year})
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        Plate: {matchedVehicle.plateNumber}
                      </p>
                      {matchedCustomer ? (
                        <p className="text-xs text-muted-foreground">
                          Owner: <span className="font-medium text-foreground">{matchedCustomer.name}</span>
                          {matchedCustomer.phone ? ` • ${matchedCustomer.phone}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Owner information unavailable.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-destructive">
                      No vehicle matches this plate number. Add it on the vehicles page first.
                    </p>
                  )
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="mechanicName">Mechanic Name</Label>
                  <Input
                    id="mechanicName"
                    value={formData.mechanicName}
                    onChange={(e) => setFormData({ ...formData, mechanicName: e.target.value })}
                    placeholder="Who performed the service?"
                    data-testid="input-mechanic-name"
                  />
                </div>
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
                <Label htmlFor="serviceMedia">Photos / Videos</Label>
                <Input
                  id="serviceMedia"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleMediaChange}
                  data-testid="input-service-media"
                />
                {mediaFiles.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-dashed border-muted p-3">
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {mediaFiles.map((file, index) => (
                        <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <span className="truncate max-w-[14rem] text-foreground">{file.name}</span>
                            <span className="text-xs">
                              {(file.size / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto px-1 text-xs text-destructive hover:text-destructive"
                            onClick={() => removeMediaFile(index)}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {mediaFiles.length} of {MAX_MEDIA_FILES} files selected.
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Upload reference photos or short videos to document the repair (max {MAX_MEDIA_FILES} files).
                </p>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="laborCost">Labor Cost</Label>
                  <Input
                    id="laborCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.laborCost}
                    onChange={(e) => setFormData({ ...formData, laborCost: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-labor-cost"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partsCost">Parts Cost</Label>
                  <Input
                    id="partsCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.partsCost}
                    onChange={(e) => setFormData({ ...formData, partsCost: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-parts-cost"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalCost">Total Cost</Label>
                  <Input
                    id="totalCost"
                    type="number"
                    step="0.01"
                    value={derivedTotalCost}
                    readOnly
                    className="bg-muted"
                    data-testid="input-total-cost"
                  />
                </div>
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
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
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
