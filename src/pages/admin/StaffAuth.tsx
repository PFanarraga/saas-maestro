import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

export default function StaffAuth() {
  const { slug } = useParams<{ slug: string }>();
  const { signInWithPassword, isAuthenticated, isLoading } = useAuth();
  const { request } = useApi();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tenant, setTenant] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (slug) {
      request<any>(`/public/tenants/${slug}`).then(({ data }) => setTenant(data));
    }
  }, [slug, request]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/store");
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setBusy(true);
    try {
      // Internal staff email format: username@slug.staff.shoply
      const email = `${username.toLowerCase()}@${slug}.staff.shoply`;
      const { error } = await signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error("Usuario o contraseña incorrectos");
      setBusy(false);
    }
  };

  if (!tenant && !isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Tienda no encontrada</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-[380px] shadow-xl border-slate-200">
        <CardHeader className="text-center">
          <div className="mx-auto size-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <Users className="size-7 text-slate-600" />
          </div>
          <CardTitle className="text-xl font-bold">{tenant?.name || "Cargando..."}</CardTitle>
          <CardDescription className="text-xs uppercase font-semibold text-slate-500 tracking-wider mt-1">
            Acceso Trabajadores
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 ml-1">Nombre de usuario</label>
              <Input
                placeholder="ej: vendedor1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 border-slate-300"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 ml-1">Contraseña</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-slate-300"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            <Button className="w-full h-11 font-semibold" disabled={busy || !tenant}>
              {busy ? <Loader2 className="animate-spin size-4" /> : <><LogIn className="mr-2 size-4" /> Ingresar al Panel</>}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
