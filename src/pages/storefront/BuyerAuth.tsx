import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Mail, Loader2, ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function BuyerAuth() {
  const { slug } = useParams<{ slug: string }>();
  const { signIn, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || `/t/${slug}`;

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      const { error } = await signIn({ email });
      if (error) throw error;
      setStep("otp");
    } catch (err: any) {
      toast.error(err.message || "No pudimos enviar el código");
    } finally {
      setBusy(false);
    }
  };

  const handleOtpSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otp.length !== 6) return;
    setBusy(true);
    try {
      const { error } = await verifyOtp({ email, token: otp });
      if (error) throw error;
      toast.success("¡Bienvenido!");
      navigate(returnTo);
    } catch (err: any) {
      toast.error("El código es incorrecto");
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-[400px] border-none shadow-2xl sf-card">
        <AnimatePresence mode="wait">
          {step === "email" ? (
            <motion.div key="email" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <CardHeader className="text-center">
                <div className="mx-auto size-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                  <Mail className="size-6 text-primary" />
                </div>
                <CardTitle className="text-xl font-bold">Iniciar Sesión</CardTitle>
                <CardDescription>Ingresa tu correo para continuar con tu compra.</CardDescription>
              </CardHeader>
              <form onSubmit={handleEmailSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Correo electrónico</Label>
                    <Input type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <Button className="w-full h-11" disabled={busy}>
                    {busy ? <Loader2 className="animate-spin size-4" /> : "Enviar código de 6 dígitos"}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => navigate(-1)}>
                    <ArrowLeft className="size-4 mr-2" /> Volver
                  </Button>
                </CardFooter>
              </form>
            </motion.div>
          ) : (
            <motion.div key="otp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <CardHeader className="text-center">
                <div className="mx-auto size-12 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                  <ShieldCheck className="size-6 text-emerald-600" />
                </div>
                <CardTitle className="text-xl font-bold">Verifica tu correo</CardTitle>
                <CardDescription>Enviamos un código a <span className="font-medium text-slate-900">{email}</span></CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="flex flex-col items-center py-4">
                  <InputOTP value={otp} onChange={setOtp} maxLength={6} onComplete={() => handleOtpSubmit()}>
                    <InputOTPGroup className="gap-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} className="size-12 border-slate-300 rounded-md text-lg" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <Button className="w-full h-11" disabled={busy || otp.length !== 6}>
                    {busy ? <Loader2 className="animate-spin size-4" /> : "Verificar e Ingresar"}
                  </Button>
                  <div className="flex justify-center gap-4 text-xs">
                    <button type="button" className="text-primary font-medium hover:underline" onClick={handleEmailSubmit}>Reenviar código</button>
                    <button type="button" className="text-slate-400 font-medium hover:underline" onClick={() => setStep("email")}>Cambiar correo</button>
                  </div>
                </CardFooter>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">{children}</label>;
}
