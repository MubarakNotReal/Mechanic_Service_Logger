import { useEffect, useMemo, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  FileImage,
  Loader2,
  Upload,
  User,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Customer, Service, Vehicle } from "@shared/schema";

const MAX_MEDIA_FILES = 10;

type LookupResult = {
  vehicle: Vehicle;
  customer: Customer | null;
};

type ServiceDraft = {
  serviceDate: string;
  mechanicName: string;
  workPerformed: string;
  partsReplaced: string;
  notes: string;
  laborCost: string;
  partsCost: string;
};

const initialDraft = (): ServiceDraft => ({
  serviceDate: format(new Date(), "yyyy-MM-dd"),
  mechanicName: "",
  workPerformed: "",
  partsReplaced: "",
  notes: "",
  laborCost: "",
  partsCost: "",
});

export default function ServiceCreatePage() {
  const [currentLocation, setLocation] = useLocation();
  const { toast } = useToast();

  const [draft, setDraft] = useState<ServiceDraft>(() => initialDraft());
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);
  const photoCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const videoCaptureInputRef = useRef<HTMLInputElement | null>(null);

  const plateParam = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const plate = urlParams.get("plate")?.trim();
    return plate ? plate.toUpperCase() : null;
  }, [currentLocation]);

  useEffect(() => {
    if (!plateParam) {
      toast({
        title: "Missing plate number",
        description: "Select a vehicle before creating a service record.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [plateParam, setLocation, toast]);

  const lookupQuery = useQuery<LookupResult>({
    queryKey: ["/api/vehicles/lookup", plateParam],
    enabled: Boolean(plateParam),
    queryFn: async () => {
      const response = await fetch(`/api/vehicles/lookup/${encodeURIComponent(plateParam!)}`, {
        credentials: "include",
      });

      if (response.status === 404) {
        throw new Error("Vehicle not found for this plate.");
      }

      if (!response.ok) {
        const message = (await response.text()) || response.statusText || "Lookup failed";
        throw new Error(message);
      }

      const payload = (await response.json()) as {
        vehicle: Vehicle;
        customer: Customer | null;
      };

      return payload;
    },
  });

  const createServiceMutation = useMutation<Service, Error, FormData>({
    mutationFn: async (formData) => {
      const response = await apiRequest("POST", "/api/services", formData);
      if (!response.ok) {
        const message = (await response.text()) || response.statusText;
        throw new Error(message);
      }

      return (await response.json()) as Service;
    },
    onSuccess: (service) => {
      toast({ title: "Service saved", description: `Service #${service.id} created successfully.` });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      if (plateParam) {
        queryClient.invalidateQueries({ queryKey: ["/api/vehicles/lookup", plateParam] });
      }
      if (plateParam) {
        setLocation(`/?plate=${encodeURIComponent(plateParam)}`);
      } else {
        setLocation("/");
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to save service",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const derivedTotalCost = useMemo(() => {
    const labor = Number.parseFloat(draft.laborCost || "0");
    const parts = Number.parseFloat(draft.partsCost || "0");

    if (!draft.laborCost && !draft.partsCost) {
      return "";
    }

    const total = (Number.isFinite(labor) ? labor : 0) + (Number.isFinite(parts) ? parts : 0);
    return total.toFixed(2);
  }, [draft.laborCost, draft.partsCost]);

  const handleDraftChange = (field: keyof ServiceDraft) => (value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const handleMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setMediaFiles((previous) => {
      const combined = [...previous, ...files];
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
    setMediaFiles((previous) => previous.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!plateParam) {
      toast({ title: "Missing plate", variant: "destructive" });
      return;
    }

    if (!draft.workPerformed.trim()) {
      toast({ title: "Add service notes", description: "Describe the work that was completed." });
      return;
    }

    const submission = new FormData();
    submission.append("plateNumber", plateParam);
    submission.append("serviceDate", new Date(draft.serviceDate).toISOString());
    submission.append("workPerformed", draft.workPerformed.trim());

    if (draft.partsReplaced.trim()) {
      submission.append("partsReplaced", draft.partsReplaced.trim());
    }

    if (draft.notes.trim()) {
      submission.append("notes", draft.notes.trim());
    }

    if (draft.mechanicName.trim()) {
      submission.append("mechanicName", draft.mechanicName.trim());
    }

    if (draft.laborCost.trim()) {
      submission.append("laborCost", draft.laborCost.trim());
    }

    if (draft.partsCost.trim()) {
      submission.append("partsCost", draft.partsCost.trim());
    }

    if (derivedTotalCost) {
      submission.append("totalCost", derivedTotalCost);
    }

    mediaFiles.forEach((file) => {
      submission.append("media", file);
    });

    createServiceMutation.mutate(submission);
  };

  const vehicle = lookupQuery.data?.vehicle;
  const customer = lookupQuery.data?.customer;

  return (
  <form className="space-y-8" onSubmit={handleSubmit}>
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (plateParam ? setLocation(`/?plate=${encodeURIComponent(plateParam)}`) : setLocation("/"))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to vehicle
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New service record</h1>
          <p className="text-muted-foreground">
            Capture photos, videos, and detail the work performed. Costs sit at the bottom so you can focus on the story first.
          </p>
        </div>
      </div>

      {lookupQuery.isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {[1, 2, 3].map((key) => (
              <Skeleton key={key} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : lookupQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {(lookupQuery.error as Error).message || "Failed to load vehicle information."}
          </CardContent>
        </Card>
      ) : vehicle ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Camera className="h-5 w-5 text-primary" />
                  Capture & describe the work
                </CardTitle>
                <CardDescription>
                  Upload rich media and explain what the team accomplished. Customers love the transparency.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="service-work">
                    Service summary *
                  </label>
                  <Textarea
                    id="service-work"
                    value={draft.workPerformed}
                    onChange={(event) => handleDraftChange("workPerformed")(event.target.value)}
                    placeholder="Describe the work performed in detail."
                    required
                    rows={6}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="service-notes">
                    Additional notes
                  </label>
                  <Textarea
                    id="service-notes"
                    value={draft.notes}
                    onChange={(event) => handleDraftChange("notes")(event.target.value)}
                    placeholder="Share recommendations, follow-ups, or diagnostics."
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Photos & videos</p>
                      <p className="text-xs text-muted-foreground">
                        Attach up to {MAX_MEDIA_FILES} files. Capture new media or select from your library.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="secondary" onClick={() => galleryFileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" />
                        Browse
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => photoCaptureInputRef.current?.click()}>
                        <Camera className="mr-2 h-4 w-4" />
                        Take photo
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => videoCaptureInputRef.current?.click()}>
                        <Video className="mr-2 h-4 w-4" />
                        Record video
                      </Button>
                    </div>
                  </div>
                  <input
                    ref={galleryFileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleMediaChange}
                  />
                  <input
                    ref={photoCaptureInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleMediaChange}
                  />
                  <input
                    ref={videoCaptureInputRef}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleMediaChange}
                  />

                  <div
                    className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-muted p-6 text-center"
                    onClick={() => galleryFileInputRef.current?.click()}
                    role="presentation"
                  >
                    <FileImage className="h-9 w-9 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">Drop files here, browse, or use camera capture</p>
                    <p className="text-xs text-muted-foreground">
                      High-quality visuals help build trust and document the job.
                    </p>
                  </div>

                  {mediaFiles.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {mediaFiles.map((file, index) => (
                        <div key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                          <div className="truncate">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMediaFile(index)}
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BadgeCheck className="h-5 w-5 text-primary" />
                    Vehicle overview
                  </CardTitle>
                  <CardDescription>Verify you are logging the correct vehicle before submitting.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Plate</p>
                      <p className="font-mono text-lg tracking-wide">{vehicle.plateNumber}</p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {vehicle.year} · {vehicle.make} {vehicle.model}
                    </Badge>
                  </div>
                  <Separator />
                  {customer ? (
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">{customer.phone}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No customer information available.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Service metadata</CardTitle>
                  <CardDescription>Capture the essentials to provide context alongside your media.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="service-date">
                      Service date
                    </label>
                    <Input
                      id="service-date"
                      type="date"
                      value={draft.serviceDate}
                      onChange={(event) => handleDraftChange("serviceDate")(event.target.value)}
                      max={format(new Date(), "yyyy-MM-dd")}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="service-mechanic">
                      Mechanic
                    </label>
                    <Input
                      id="service-mechanic"
                      value={draft.mechanicName}
                      onChange={(event) => handleDraftChange("mechanicName")(event.target.value)}
                      placeholder="Who carried out the work?"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="service-parts">
                      Parts replaced
                    </label>
                    <Textarea
                      id="service-parts"
                      value={draft.partsReplaced}
                      onChange={(event) => handleDraftChange("partsReplaced")(event.target.value)}
                      placeholder="List any major components swapped out during the visit."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cost breakdown</CardTitle>
              <CardDescription>Log labor and parts totals once you have the story captured.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="service-labor">
                  Labor cost
                </label>
                <Input
                  id="service-labor"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={draft.laborCost}
                  onChange={(event) => handleDraftChange("laborCost")(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="service-parts-cost">
                  Parts cost
                </label>
                <Input
                  id="service-parts-cost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={draft.partsCost}
                  onChange={(event) => handleDraftChange("partsCost")(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="service-total">
                  Total (calculated)
                </label>
                <Input id="service-total" value={derivedTotalCost} readOnly placeholder="—" />
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => (plateParam ? setLocation(`/?plate=${encodeURIComponent(plateParam)}`) : setLocation("/"))}
          disabled={createServiceMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createServiceMutation.isPending || lookupQuery.isLoading}>
          {createServiceMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving
            </>
          ) : (
            "Save service"
          )}
        </Button>
      </div>
    </form>
  );
}
