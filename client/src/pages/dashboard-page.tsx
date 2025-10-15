import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

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
    };
  }, [customers.length, services, vehicles.length]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold sm:text-3xl" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground sm:text-base">Welcome to AutoShop Manager</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-6 lg:grid-cols-2">
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
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
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
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-lg font-semibold">{item.value}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Today’s traffic</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:px-6 sm:pb-6">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full sm:h-[260px]" />
            ) : (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
