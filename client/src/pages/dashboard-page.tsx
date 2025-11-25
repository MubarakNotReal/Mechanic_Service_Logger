import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Car, Wrench, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { Customer, Vehicle, Service } from "@shared/schema";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "SAR",
  minimumFractionDigits: 2,
});

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { data: customers = [], isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: services = [], isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const isLoading = loadingCustomers || loadingVehicles || loadingServices;

  const {
    overallStats,
    monthlyStats,
    dailyStats,
    hourlyChartData,
    monthlyChartData,
    yearlyChartData,
    recentServices,
  } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
    const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

    const servicesThisMonth = services.filter((service) => {
      const serviceDate = new Date(service.serviceDate);
      return (
        serviceDate.getFullYear() === currentYear && serviceDate.getMonth() === currentMonth
      );
    });

    const servicesToday = services.filter((service) => {
      const serviceDate = new Date(service.serviceDate);
      return (
        serviceDate.getFullYear() === currentYear &&
        serviceDate.getMonth() === currentMonth &&
        serviceDate.getDate() === now.getDate()
      );
    });

    const totalRevenueAllTime = services.reduce(
      (sum, service) => sum + Number.parseFloat(service.totalCost || "0"),
      0,
    );

    const totalRevenueThisMonth = servicesThisMonth.reduce(
      (sum, service) => sum + Number.parseFloat(service.totalCost || "0"),
      0,
    );

    const totalRevenueToday = servicesToday.reduce(
      (sum, service) => sum + Number.parseFloat(service.totalCost || "0"),
      0,
    );

    const monthlyCustomerSet = new Set(servicesThisMonth.map((service) => service.customerId));
    const dailyCustomerSet = new Set(servicesToday.map((service) => service.customerId));

    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour.toString().padStart(2, "0")}:00`,
      count: 0,
    }));

    servicesToday.forEach((service) => {
      const serviceDate = new Date(service.serviceDate);
      const hour = serviceDate.getHours();
      hourlyData[hour].count += 1;
    });

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthData = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return {
        day,
        label: format(new Date(currentYear, currentMonth, day), "MMM d"),
        count: 0,
      };
    });

    servicesThisMonth.forEach((service) => {
      const serviceDate = new Date(service.serviceDate);
      const day = serviceDate.getDate();
      const entry = monthData[day - 1];
      if (entry) {
        entry.count += 1;
      }
    });

    const startOfRange = new Date(currentYear, currentMonth - 11, 1);

    const yearlyBuckets = Array.from({ length: 12 }, (_, index) => {
      const bucketDate = new Date(startOfRange.getFullYear(), startOfRange.getMonth() + index, 1);
      return {
        key: `${bucketDate.getFullYear()}-${bucketDate.getMonth()}`,
        label: format(bucketDate, "MMM yy"),
        count: 0,
        year: bucketDate.getFullYear(),
        month: bucketDate.getMonth(),
      };
    });

    const yearlyBucketMap = new Map(yearlyBuckets.map((bucket) => [bucket.key, bucket]));

    services.forEach((service) => {
      const serviceDate = new Date(service.serviceDate);
      if (serviceDate < startOfRange) {
        return;
      }

      const key = `${serviceDate.getFullYear()}-${serviceDate.getMonth()}`;
      const bucket = yearlyBucketMap.get(key);
      if (bucket) {
        bucket.count += 1;
      }
    });

    const recentServices = services
      .slice()
      .sort(
        (a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime(),
      )
      .slice(0, 6)
      .map((service) => {
        const customer = customerMap.get(service.customerId);
        const vehicle = vehicleMap.get(service.vehicleId);
        const totalCost = Number.parseFloat(service.totalCost ?? "0") || 0;

        return {
          id: service.id,
          customerName: customer?.name ?? "Unknown customer",
          vehicleLabel: vehicle
            ? `${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})`
            : "Unknown vehicle",
          serviceDate: service.serviceDate,
          status: service.status,
          totalCost: currencyFormatter.format(totalCost),
        };
      });

    return {
      overallStats: [
        {
          title: "Total Customers",
          value: customers.length.toLocaleString(),
          icon: Users,
          color: "text-blue-600",
          bgColor: "bg-blue-600/10",
        },
        {
          title: "Total Vehicles",
          value: vehicles.length.toLocaleString(),
          icon: Car,
          color: "text-green-600",
          bgColor: "bg-green-600/10",
        },
        {
          title: "Total Services",
          value: services.length.toLocaleString(),
          icon: Wrench,
          color: "text-purple-600",
          bgColor: "bg-purple-600/10",
        },
        {
          title: "Total Revenue",
          value: currencyFormatter.format(totalRevenueAllTime),
          icon: DollarSign,
          color: "text-amber-600",
          bgColor: "bg-amber-600/10",
        },
      ],
      monthlyStats: [
        {
          label: "Services this month",
          value: servicesThisMonth.length.toLocaleString(),
        },
        {
          label: "Unique customers",
          value: monthlyCustomerSet.size.toLocaleString(),
        },
        {
          label: "Revenue this month",
          value: currencyFormatter.format(totalRevenueThisMonth),
        },
      ],
      dailyStats: [
        {
          label: "Services today",
          value: servicesToday.length.toLocaleString(),
        },
        {
          label: "Unique customers",
          value: dailyCustomerSet.size.toLocaleString(),
        },
        {
          label: "Revenue today",
          value: currencyFormatter.format(totalRevenueToday),
        },
      ],
      hourlyChartData: hourlyData,
      monthlyChartData: monthData.slice(0, now.getDate()),
      yearlyChartData: yearlyBuckets,
      recentServices,
    };
  }, [customers, services, vehicles]);

  return (
  <div className="mx-auto max-w-6xl space-y-8 px-3 sm:px-4 lg:px-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold sm:text-3xl" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">Welcome to AutoShop Manager</p>
      </div>

  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {overallStats.map((stat, index) => (
          <Card key={stat.title} data-testid={`card-stat-${index}`} className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 sm:p-6">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`h-10 w-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:px-6 sm:pb-6">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold" data-testid={`text-stat-value-${index}`}>
                  {stat.value}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:px-6 sm:pb-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : recentServices.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No recent services recorded.
              </div>
            ) : (
              <div className="space-y-3">
                {recentServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setLocation(`/services/${service.id}`)}
                    className="flex w-full flex-col gap-3 rounded-lg border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-row sm:items-center sm:justify-between"
                    aria-label={`View service ${service.id} details for ${service.vehicleLabel}`}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold sm:text-base">{service.customerName}</p>
                      <p className="text-sm text-muted-foreground">{service.vehicleLabel}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                      <div className="flex items-center gap-2 sm:justify-end">
                        <Badge variant="outline" className="capitalize">
                          {service.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-sm font-semibold">{service.totalCost}</span>
                      </div>
                      <span className="text-xs text-muted-foreground sm:text-sm">
                        {format(new Date(service.serviceDate), "PPp")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

  <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Stats by month</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:px-6 sm:pb-6">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-6 w-2/3" />
                  ))}
                </div>
              ) : (
                monthlyStats.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg bg-muted px-4 py-3"
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-lg font-semibold">{item.value}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle>Stats by day</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:px-6 sm:pb-6">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-6 w-2/3" />
                  ))}
                </div>
              ) : (
                dailyStats.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg bg-muted px-4 py-3"
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-lg font-semibold">{item.value}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Today’s traffic</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:px-6 sm:pb-6">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full sm:h-[260px]" />
            ) : (
              <div className="w-full overflow-x-auto">
                <ChartContainer
                  className="h-[220px] w-full sm:h-[260px]"
                  config={{ requests: { label: "Requests", color: "hsl(217, 91%, 60%)" } }}
                >
                  <BarChart data={hourlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickMargin={8} minTickGap={12} />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip cursor={{ fill: "rgba(59,130,246,0.1)" }} content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="count"
                      fill="var(--color-requests)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>This month’s traffic</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:px-6 sm:pb-6">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full sm:h-[260px]" />
            ) : (
              <div className="w-full overflow-x-auto">
                <ChartContainer
                  className="h-[220px] w-full sm:h-[260px]"
                  config={{ requests: { label: "Requests", color: "hsl(142, 71%, 45%)" } }}
                >
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickMargin={8} minTickGap={12} />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip cursor={{ fill: "rgba(34,197,94,0.1)" }} content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="count"
                      fill="var(--color-requests)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Yearly traffic</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:px-6 sm:pb-6">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full sm:h-[260px]" />
            ) : (
              <div className="w-full overflow-x-auto">
                <ChartContainer
                  className="h-[220px] w-full sm:h-[260px]"
                  config={{ requests: { label: "Requests", color: "hsl(12, 86%, 55%)" } }}
                >
                  <BarChart data={yearlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickMargin={8} minTickGap={12} />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip cursor={{ fill: "rgba(248,113,113,0.1)" }} content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="count"
                      fill="var(--color-requests)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
