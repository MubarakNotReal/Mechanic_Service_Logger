import { Suspense, lazy } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppSidebar } from "@/components/app-sidebar";
import type React from "react";

const VehiclesPage = lazy(() => import("@/pages/vehicles-page"));
const ServiceCreatePage = lazy(() => import("@/pages/service-create-page"));
const ServiceDetailPage = lazy(() => import("@/pages/service-detail-page"));
const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const NotFound = lazy(() => import("@/pages/not-found"));

function Router() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
      <Switch>
        <ProtectedRoute path="/" component={VehiclesPage} />
        <ProtectedRoute path="/services/new" component={ServiceCreatePage} />
        <ProtectedRoute path="/services/:serviceId" component={ServiceDetailPage} />
        <ProtectedRoute path="/dashboard" component={DashboardPage} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
              <AppContent />
            </Suspense>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const { user } = useAuth();
  const [location] = useLocation();
  const isAuthRoute = location.startsWith("/auth");

  if (!user || isAuthRoute) {
    return (
      <div className="min-h-screen">
        <Router />
      </div>
    );
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5 lg:p-6">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8">
            <div className="mx-auto max-w-6xl w-full space-y-6">
              <Router />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
