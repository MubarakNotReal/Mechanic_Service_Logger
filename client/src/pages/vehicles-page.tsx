import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Car as CarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Vehicle, InsertVehicle, Customer } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function VehiclesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<InsertVehicle>({
    customerId: 0,
    plateNumber: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
  });

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: customers = [], isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertVehicle) => {
      const res = await apiRequest("POST", "/api/vehicles", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Vehicle created successfully" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create vehicle", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: InsertVehicle }) => {
      const res = await apiRequest("PATCH", `/api/vehicles/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Vehicle updated successfully" });
      setDialogOpen(false);
      setEditingVehicle(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update vehicle", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/vehicles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      toast({ title: "Vehicle deleted successfully" });
      setDeleteDialogOpen(false);
      setDeletingVehicle(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete vehicle", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      customerId: 0,
      plateNumber: "",
      make: "",
      model: "",
      year: new Date().getFullYear(),
    });
  };

  const handleOpenDialog = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        customerId: vehicle.customerId,
        plateNumber: vehicle.plateNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
      });
    } else {
      setEditingVehicle(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVehicle) {
      updateMutation.mutate({ id: editingVehicle.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (vehicle: Vehicle) => {
    setDeletingVehicle(vehicle);
    setDeleteDialogOpen(true);
  };

  const filteredVehicles = vehicles.filter(
    (vehicle) =>
      vehicle.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customers.find((c) => c.id === vehicle.customerId)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canEdit = user?.role === "admin" || user?.role === "mechanic";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-vehicles-title">Vehicles</h1>
          <p className="text-muted-foreground">Manage vehicle information and ownership</p>
        </div>
        {canEdit && (
          <Button onClick={() => handleOpenDialog()} data-testid="button-add-vehicle">
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by plate number, make, model, or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
              data-testid="input-vehicle-search"
            />
          </div>

          {loadingVehicles || loadingCustomers ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No vehicles found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plate Number</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Owner</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => {
                  const customer = customers.find((c) => c.id === vehicle.customerId);
                  return (
                    <TableRow key={vehicle.id} data-testid={`row-vehicle-${vehicle.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CarIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono font-semibold">{vehicle.plateNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {vehicle.make} {vehicle.model}
                      </TableCell>
                      <TableCell>{vehicle.year}</TableCell>
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
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(vehicle)}
                              data-testid={`button-edit-vehicle-${vehicle.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(vehicle)}
                              data-testid={`button-delete-vehicle-${vehicle.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
            <DialogDescription>
              {editingVehicle
                ? "Update vehicle information below"
                : "Enter vehicle details to create a new record"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Owner *</Label>
              <Select
                value={formData.customerId.toString()}
                onValueChange={(value) => setFormData({ ...formData, customerId: parseInt(value) })}
              >
                <SelectTrigger id="customer" data-testid="select-vehicle-customer">
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
              <Label htmlFor="plateNumber">Plate Number *</Label>
              <Input
                id="plateNumber"
                value={formData.plateNumber}
                onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
                required
                data-testid="input-vehicle-plate"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="make">Make *</Label>
                <Input
                  id="make"
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  required
                  data-testid="input-vehicle-make"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  required
                  data-testid="input-vehicle-model"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                min="1900"
                max={new Date().getFullYear() + 1}
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                required
                data-testid="input-vehicle-year"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel-vehicle"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-vehicle"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingVehicle
                  ? "Update"
                  : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deletingVehicle?.plateNumber} ({deletingVehicle?.make}{" "}
              {deletingVehicle?.model}) and all associated service records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingVehicle && deleteMutation.mutate(deletingVehicle.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
