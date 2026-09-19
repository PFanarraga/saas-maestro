import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail, UserX, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";

function AuthContent({ redirectAfterAuth = "/start" }: { redirectAfterAuth?: string }) {
  const { isLoading: authLoading, isAuthenticated, signIn, verifyOtp, signInAnonymous, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || redirectAfterAuth;

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(returnTo);
    }
  }, [authLoading, isAuthenticated, navigate, returnTo]);

  // Pantalla de error si Supabase no está configurado (problema de variables de entorno)
  if (!isConfigured && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full border-red-200 shadow-xl shadow-red-900/5">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto size-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="size-8 text-red-600" />
            </div>
            <CardTitle className="text-xl text-red-950 font-bold">Error de Configuración</CardTitle>
            <CardDescription className="text-red-700/80">
              La aplicación no detecta las credenciales de Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-red-900 space-y-2">
              <p className="font-semibold">Cómo solucionar esto:</p>
              <ol className="list-decimal ml-4 space-y-1 opacity-90">
                <li>Ve al Dashboard de <b>Cloudflare Pages</b>.</li>
                <li>Entra en <b>Settings &gt; Build & deployments</b>.</li>
                <li>En <b>Environment variables</b>, agrega <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.</li>
                <li><b>IMPORTANTE:</b> Ve a la pestaña <b>Deployments</b> y haz clic en <b>"Retry deployment"</b>.</li>
              </ol>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
              Hecho esto, actualizar página
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const { error } = await signIn({ email });
      if (error) throw error;
      setStep("otp");
      setStatus("idle");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "No pudimos enviar el código. Verifica tu conexión.");
    }
  };

  const handleOtpSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otp.length !== 6) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const { error } = await verifyOtp({ email, token: otp });
      if (error) throw error;
      setStatus("success");
      // Navigation is handled by useEffect
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg("El código es incorrecto o ha expirado.");
      setOtp("");
    }
  };

  const handleGuest = async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const { error } = await signInAnonymous();
      if (error) throw error;
      setStatus("success");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "Error al entrar como invitado.");
    }
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
            {step === "email" ? (
              <motion.div
                key="email-step"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader className="space-y-1">
                  <CardTitle className="text-xl">Iniciar Sesión</CardTitle>
                  <CardDescription>
                    Ingresa tu correo para recibir un código de acceso.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 size-4 text-slate-400" />
                        <Input
                          type="email"
                          placeholder="nombre@ejemplo.com"
                          className="pl-10 h-11"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={status === "loading"}
                          required
                        />
                      </div>
                    </div>
                    {status === "error" && (
                      <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-xs font-medium border border-red-100">
                        <AlertCircle className="size-4 shrink-0" />
                        {errorMsg}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4">
                    <Button className="w-full h-11 text-sm font-semibold group" disabled={status === "loading"}>
                      {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : (
                        <>Continuar <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" /></>
                      )}
                    </Button>

                    <div className="relative w-full">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100" /></div>
                      <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest text-slate-400"><span className="bg-white px-3">O también</span></div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 text-slate-600 hover:bg-slate-50 transition-colors"
                      onClick={handleGuest}
                      disabled={status === "loading"}
                    >
                      <UserX className="mr-2 size-4 opacity-70" />
                      Entrar como invitado
                    </Button>
                  </CardFooter>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">Verifica tu correo</CardTitle>
                    <button className="text-xs text-primary font-medium hover:underline" onClick={() => setStep("email")}>Cambiar email</button>
                  </div>
                  <CardDescription>
                    Escribe el código de 6 dígitos que enviamos a <span className="text-slate-900 font-medium">{email}</span>.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="space-y-6 flex flex-col items-center py-6">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      onComplete={() => handleOtpSubmit()}
                      disabled={status === "loading" || status === "success"}
                    >
                      <InputOTPGroup className="gap-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <InputOTPSlot
                            key={i}
                            index={i}
                            className="h-12 w-10 sm:w-12 text-lg border-slate-300 rounded-md focus:ring-primary shadow-sm"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>

                    {status === "error" && (
                      <div className="w-full flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-xs font-medium border border-red-100">
                        <AlertCircle className="size-4 shrink-0" />
                        {errorMsg}
                      </div>
                    )}

                    {status === "success" && (
                      <div className="w-full flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg text-xs font-medium border border-emerald-100">
                        <CheckCircle2 className="size-4 shrink-0" />
                        ¡Código verificado! Entrando...
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full h-11 font-semibold"
                      disabled={status === "loading" || status === "success" || otp.length !== 6}
                    >
                      {status === "loading" ? <Loader2 className="size-4 animate-spin" /> : "Verificar código"}
                    </Button>
                  </CardFooter>
                </form>
              </motion.div>
            )}
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
