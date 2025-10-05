import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Car, Wrench, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { Customer, Vehicle, Service } from "@shared/schema";

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

  const thisMonthServices = services.filter((s) => {
    const serviceDate = new Date(s.serviceDate);
    const now = new Date();
    return (
      serviceDate.getMonth() === now.getMonth() &&
      serviceDate.getFullYear() === now.getFullYear()
    );
  });

  const totalRevenue = thisMonthServices.reduce(
    (sum, s) => sum + parseFloat(s.totalCost),
    0
  );

  const recentServices = [...services]
    .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())
    .slice(0, 5);

  const stats = [
    {
      title: "Total Customers",
      value: customers.length,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
    },
    {
      title: "Total Vehicles",
      value: vehicles.length,
      icon: Car,
      color: "text-green-600",
      bgColor: "bg-green-600/10",
    },
    {
      title: "Services This Month",
      value: thisMonthServices.length,
      icon: Wrench,
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
    },
    {
      title: "Monthly Revenue",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: "text-amber-600",
      bgColor: "bg-amber-600/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to AutoShop Manager</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} data-testid={`card-stat-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`h-10 w-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {loadingCustomers || loadingVehicles || loadingServices ? (
                <Skeleton className="h-8 w-20" />
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
          <CardHeader>
            <CardTitle>Recent Services</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingServices ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentServices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No services recorded yet
              </p>
            ) : (
              <div className="space-y-4">
                {recentServices.map((service) => {
                  const vehicle = vehicles.find((v) => v.id === service.vehicleId);
                  const customer = customers.find((c) => c.id === service.customerId);
                  return (
                    <div
                      key={service.id}
                      className="flex items-start gap-4 p-3 rounded-lg hover-elevate"
                      data-testid={`service-item-${service.id}`}
                    >
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{service.workPerformed}</p>
                        <p className="text-sm text-muted-foreground">
                          {vehicle?.plateNumber} • {customer?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(service.serviceDate), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold">${parseFloat(service.totalCost).toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingCustomers || loadingVehicles || loadingServices ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm font-medium">Average Vehicles per Customer</span>
                  <span className="text-lg font-bold">
                    {customers.length > 0
                      ? (vehicles.length / customers.length).toFixed(1)
                      : "0"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm font-medium">Average Service Cost</span>
                  <span className="text-lg font-bold">
                    ${services.length > 0
                      ? (services.reduce((sum, s) => sum + parseFloat(s.totalCost), 0) / services.length).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm font-medium">Total Services</span>
                  <span className="text-lg font-bold">{services.length}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
