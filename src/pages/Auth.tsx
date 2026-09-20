import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldAlert } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";

function AuthContent({ redirectAfterAuth = "/start" }: { redirectAfterAuth?: string }) {
  const { isLoading: authLoading, isAuthenticated, signInWithPassword, signIn, verifyOtp, isConfigured, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || redirectAfterAuth;

  const [step, setStep] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.isVerified) {
        navigate(returnTo);
      } else {
        setStep("otp");
      }
    }
  }, [authLoading, isAuthenticated, navigate, returnTo, user]);

  const apiUrl = import.meta.env.VITE_API_URL || "";
  const isUrlValid = apiUrl.endsWith("/functions/v1/api");

  // Pantalla de error si Supabase no está configurado (problema de variables de entorno)
  if ((!isConfigured || !isUrlValid) && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full border-red-200 shadow-xl shadow-red-900/5">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto size-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="size-8 text-red-600" />
            </div>
            <CardTitle className="text-xl text-red-950 font-bold">Error de Configuración</CardTitle>
            <CardDescription className="text-red-700/80 text-sm">
              {!isConfigured
                ? "La aplicación no detecta las credenciales de Supabase."
                : "La VITE_API_URL parece estar incompleta o mal configurada."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-center">
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-red-900 text-left space-y-2">
              <p className="font-semibold">Revisa esto en Cloudflare Pages:</p>
              <ul className="list-disc ml-4 space-y-1 opacity-90 text-[13px]">
                <li><b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> deben estar presentes.</li>
                <li><b>VITE_API_URL</b> debe terminar exactamente en: <br/><code className="bg-white/50 px-1 rounded">/functions/v1/api</code></li>
              </ul>
            </div>
            <p className="text-[11px] text-slate-500">
              Después de guardar, ve a <b>Deployments</b> y haz clic en <b>"Retry deployment"</b> del último build.
            </p>
          </CardContent>
          <CardFooter>
            <div className="w-full space-y-2">
              <Button className="w-full" onClick={() => window.location.reload()}>
                Actualizar página
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleOtpSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otp.length !== 6) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const { error } = await verifyOtp({ email: user?.email || email, token: otp });
      if (error) throw error;
      setStatus("success");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg("El código es incorrecto o ha expirado.");
      setOtp("");
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const targetEmail = user?.email || email;
    if (!targetEmail) return;

    try {
      const { error } = await signIn({ email: targetEmail });
      if (error) throw error;
      setResendCooldown(60);
    } catch (err: any) {
      toast.error("Error al reenviar el código");
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const { error } = await signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("Credenciales inválidas. ¿Aún no tienes cuenta?");
        }
        throw error;
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  };

  const renderForm = () => {
    if (step === "password") {
      return (
        <form onSubmit={handlePasswordSubmit}>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Acceso Dueño</CardTitle>
            <CardDescription className="text-center">Ingresa con tu correo y contraseña.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {status === "error" && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{errorMsg}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full h-11" disabled={status === "loading"}>
              {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Continuar"}
            </Button>
            <Button type="button" variant="link" size="sm" onClick={() => navigate("/register")}>¿No tienes cuenta? Regístrate</Button>
          </CardFooter>
        </form>
      );
    }

    return (
      <form onSubmit={handleOtpSubmit}>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between"><CardTitle className="text-xl">Verifica tu correo</CardTitle></div>
          <CardDescription>Escribe el código enviado a <span className="text-slate-950 font-medium">{user?.email || email}</span>.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 flex flex-col items-center">
          <InputOTP value={otp} onChange={setOtp} maxLength={6} onComplete={() => handleOtpSubmit()}>
            <InputOTPGroup className="gap-2">
              {Array.from({ length: 6 }).map((_, i) => <InputOTPSlot key={i} index={i} className="size-12 border-slate-300 rounded-md text-lg" />)}
            </InputOTPGroup>
          </InputOTP>

          <div className="text-center space-y-2 w-full">
            {status === "error" && <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded">{errorMsg}</p>}

            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className={`text-xs font-medium transition-colors ${resendCooldown > 0 ? "text-slate-400 cursor-not-allowed" : "text-primary hover:underline"}`}
            >
              {resendCooldown > 0 ? `Reenviar código en ${resendCooldown}s` : "Reenviar código de verificación"}
            </button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full h-11" disabled={status === "loading" || otp.length !== 6}>
            {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Verificar código"}
          </Button>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            onClick={async () => {
              await signOut();
              setStep("password");
            }}
          >
            ¿Usar otra cuenta? Salir
          </button>
        </CardFooter>
      </form>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-slate-50/50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-8 flex flex-col items-center gap-2">
          <img
            src="/logo.png"
            alt="Shoply"
            className="size-20 rounded-2xl shadow-lg object-cover cursor-pointer hover:scale-105 transition-transform"
            onClick={() => navigate("/")}
          />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">Shoply</h1>
        </div>

        <Card className="border-slate-200/60 shadow-2xl shadow-slate-200/50 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderForm()}
            </motion.div>
          </AnimatePresence>
        </Card>

        <p className="mt-8 text-center text-xs text-slate-400">
          Al continuar, aceptas nuestros términos y condiciones.
        </p>
      </motion.div>
    </div>
  );
}

export default function AuthPage(props: any) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-300" /></div>}>
      <AuthContent {...props} />
    </Suspense>
  );
}
