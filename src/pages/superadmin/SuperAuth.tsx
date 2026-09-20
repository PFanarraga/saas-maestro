import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export default function SuperAuth() {
  const { signInWithPassword, isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.platformRole === "super_admin") {
      navigate("/admin");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await signInWithPassword({ email, password });
      if (error) throw error;
      // Redirect handled by useEffect
    } catch (err: any) {
      toast.error(err.message || "Acceso denegado");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="w-full max-w-[400px] border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto size-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Portal Maestro</CardTitle>
          <CardDescription className="text-slate-400 text-xs uppercase tracking-widest font-bold mt-1">
            Plataforma Shoply
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Usuario Administrador</label>
              <Input
                type="email"
                placeholder="email@maestro.com"
                className="bg-slate-800 border-slate-700 text-white h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Contraseña de Seguridad</label>
              <Input
                type="password"
                placeholder="••••••••"
                className="bg-slate-800 border-slate-700 text-white h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            <Button className="w-full h-11 font-bold shadow-lg shadow-primary/20" disabled={busy}>
              {busy ? <Loader2 className="animate-spin size-4" /> : <><Lock className="mr-2 size-4" /> Autenticar</>}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
