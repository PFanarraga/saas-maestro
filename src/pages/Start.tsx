import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, ShieldCheck, Store } from "lucide-react";
import { useNavigate } from "react-router";

export default function Start() {
  const { isLoading: authLoading, isAuthenticated, user, signOut } = useAuth();
  const { request } = useApi();
  const navigate = useNavigate();
  const [access, setAccess] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    async function init() {
      // Bootstrap and claim
      await request("/me/bootstrap", { method: "POST" });
      await request("/me/claim-membership", { method: "POST" });

      // Fetch access context
      const { data } = await request<any>("/me/access");
      setAccess(data);
      setIsLoading(false);
    }

    init();
  }, [authLoading, isAuthenticated, request, navigate]);

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const isSuperAdmin = user?.platformRole === "super_admin";
  const hasTenant = !!access?.tenantId;

  if (isSuperAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <ShieldCheck className="mx-auto size-10 text-primary" />
            <CardTitle>Eres Super Admin</CardTitle>
            <CardDescription>Accede al panel maestro de la plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/admin")}>Abrir Super Admin</Button>
            <Button variant="ghost" className="w-full mt-2" onClick={() => signOut().then(() => navigate("/"))}>Salir</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (hasTenant) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <Store className="mx-auto size-10 text-primary" />
            <CardTitle>{access?.tenantName}</CardTitle>
            <CardDescription>
              Tu rol: <Badge variant="outline" className="ml-1">{access?.tenantRole === "owner" ? "Propietario" : "Staff"}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/store")}>Ir al panel de la tienda</Button>
            <Button variant="ghost" className="w-full mt-2" onClick={() => signOut().then(() => navigate("/"))}>Salir</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <Store className="mx-auto size-10 text-muted-foreground" />
          <CardTitle>Bienvenido{user?.name ? `, ${user.name}` : ""}</CardTitle>
          <CardDescription>
            Tu cuenta no está asignada a ninguna tienda todavía. Pide al Super Admin que agregue tu email como administrador de una tienda y vuelve a ingresar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => signOut().then(() => navigate("/"))}>
            <LogOut className="size-4 mr-1" /> Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
