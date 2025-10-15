import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, ClipboardCheck, Users, TrendingUp } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [loginData, setLoginData] = useState({ username: "", password: "" });

  if (user) {
    return <Redirect to="/" />;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-10 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">AutoShop Manager</h1>
            </div>
            <ThemeToggle />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Welcome Back</CardTitle>
              <CardDescription>Sign in with your shop credentials to continue</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    type="text"
                    placeholder="Enter your username"
                    value={loginData.username}
                    onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                    required
                    data-testid="input-login-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                    data-testid="input-login-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login-submit"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Use the credentials provided by your shop administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

  <div className="hidden lg:flex items-center justify-center bg-muted p-12">
        <div className="max-w-md space-y-8">
          <div>
            <h2 className="text-3xl font-bold mb-4">Professional Shop Management</h2>
            <p className="text-lg text-muted-foreground">
              Streamline your mechanic shop operations with powerful tools for customer tracking,
              vehicle management, and service history.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Customer Management</h3>
                <p className="text-sm text-muted-foreground">
                  Track customer information, vehicles, and complete service history in one place.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClipboardCheck className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Service Records</h3>
                <p className="text-sm text-muted-foreground">
                  Document every repair with detailed work logs, parts used, and cost breakdowns.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Business Insights</h3>
                <p className="text-sm text-muted-foreground">
                  View dashboard analytics and track your shop's performance over time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
