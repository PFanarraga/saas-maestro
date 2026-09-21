import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, ArrowLeft, ArrowRight, Store, User, Building2, CreditCard, Layout } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { TemplateRegistry } from "@/lib/templates/registry";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "account", title: "Tu Cuenta", icon: User },
  { id: "business", title: "Tu Negocio", icon: Building2 },
  { id: "design", title: "Tu Diseño", icon: Layout },
  { id: "plan", title: "Tu Plan", icon: CreditCard },
  { id: "success", title: "¡Listo!", icon: CheckCircle2 },
];

export default function RegisterWizard() {
  const { signUp, isAuthenticated, user, isLoading: authLoading } = useAuth();
  const { request } = useApi();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setForm] = useState({
    // Account
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    tosAccepted: false,
    marketingAccepted: false,
    // Business
    businessName: "",
    category: "",
    description: "",
    country: "Perú",
    city: "",
    address: "",
    phone: "",
    // Store
    storeName: "",
    slug: "",
    template: "minimal",
    primaryColor: "#00a8ff",
    // Plan
    planCode: "FREE",
  });

  const [isBusy, setIsBusy] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "taken" | "available">("idle");

  // Redirigir si ya está autenticado y verificado
  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.isVerified) {
      navigate("/start");
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const validateStep = () => {
    if (currentStep === 0) {
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) return false;
      if (formData.password !== formData.confirmPassword) {
        toast.error("Las contraseñas no coinciden");
        return false;
      }
      if (!formData.tosAccepted) {
        toast.error("Debes aceptar los términos y condiciones");
        return false;
      }
    }
    if (currentStep === 1) {
      if (!formData.businessName || !formData.category || !formData.phone) return false;
    }
    if (currentStep === 2) {
      if (!formData.storeName || !formData.slug) return false;
      if (slugStatus === "taken") {
        toast.error("El nombre de la tienda ya está ocupado");
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (validateStep()) setCurrentStep(s => s + 1);
  };

  const back = () => setCurrentStep(s => s - 1);

  const handleSlugChange = (val: string) => {
    const slug = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setForm({ ...formData, slug });
    // Aquí iría validación real vía API
  };

  const handleSubmit = async () => {
    setIsBusy(true);
    try {
      // 1. Crear cuenta en Supabase
      const { error: signUpError } = await signUp({
        email: formData.email,
        password: formData.password,
        name: `${formData.firstName} ${formData.lastName}`,
        tosAccepted: formData.tosAccepted,
        marketingAccepted: formData.marketingAccepted,
      });

      if (signUpError) throw signUpError;

      // 2. Crear Tienda y Membresía (esto debería ser un solo endpoint atómico en el backend)
      const { error: apiError } = await request("/superadmin/tenants", {
        method: "POST",
        body: JSON.stringify({
          name: formData.storeName,
          slug: formData.slug,
          template: formData.template,
          planCode: formData.planCode,
          adminEmail: formData.email,
          adminName: `${formData.firstName} ${formData.lastName}`,
          whatsappPhone: formData.phone,
          businessName: formData.businessName,
          category: formData.category,
          description: formData.description,
          country: formData.country,
          city: formData.city,
          address: formData.address,
          businessPhone: formData.phone,
        })
      });

      if (apiError) throw new Error(apiError);

      setCurrentStep(4); // Success
    } catch (err: any) {
      toast.error(err.message || "Error al procesar el registro");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Shoply" className="size-16 rounded-xl shadow-md mb-2" />
          <h1 className="text-2xl font-bold text-slate-900">Crea tu cuenta Shoply</h1>
        </div>

        <div className="mb-8 px-4">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-4">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div className={`size-8 rounded-full flex items-center justify-center transition-colors ${i <= currentStep ? "bg-primary text-white" : "bg-slate-200 text-slate-400"}`}>
                  <s.icon className="size-4" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block ${i <= currentStep ? "text-primary" : "text-slate-400"}`}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-none shadow-2xl shadow-slate-200 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 0 && (
                <>
                  <CardHeader>
                    <CardTitle>Datos Personales</CardTitle>
                    <CardDescription>Crea tu acceso de administrador.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Nombres</Label><Input value={formData.firstName} onChange={e => setForm({...formData, firstName: e.target.value})} placeholder="Ej: Pedro" /></div>
                    <div className="space-y-1.5"><Label>Apellidos</Label><Input value={formData.lastName} onChange={e => setForm({...formData, lastName: e.target.value})} placeholder="Ej: Fanarraga" /></div>
                    <div className="space-y-1.5 sm:col-span-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setForm({...formData, email: e.target.value})} placeholder="admin@tienda.com" /></div>
                    <div className="space-y-1.5"><Label>Contraseña</Label><Input type="password" value={formData.password} onChange={e => setForm({...formData, password: e.target.value})} /></div>
                    <div className="space-y-1.5"><Label>Confirmar</Label><Input type="password" value={formData.confirmPassword} onChange={e => setForm({...formData, confirmPassword: e.target.value})} /></div>
                    <div className="sm:col-span-2 space-y-3 pt-2">
                      <div className="flex gap-2"><input type="checkbox" id="tos" checked={formData.tosAccepted} onChange={e => setForm({...formData, tosAccepted: e.target.checked})} /><label htmlFor="tos" className="text-xs text-slate-600">Acepto los términos de servicio y políticas de privacidad.</label></div>
                      <div className="flex gap-2"><input type="checkbox" id="mkt" checked={formData.marketingAccepted} onChange={e => setForm({...formData, marketingAccepted: e.target.checked})} /><label htmlFor="mkt" className="text-xs text-slate-600">Acepto recibir noticias y actualizaciones de Shoply.</label></div>
                    </div>
                  </CardContent>
                </>
              )}

              {currentStep === 1 && (
                <>
                  <CardHeader>
                    <CardTitle>Tu Negocio</CardTitle>
                    <CardDescription>Cuéntanos un poco sobre tu actividad comercial.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5"><Label>Nombre Comercial</Label><Input value={formData.businessName} onChange={e => setForm({...formData, businessName: e.target.value})} placeholder="Ej: Mi Tienda Online" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Categoría</Label>
                        <Select value={formData.category} onValueChange={v => setForm({...formData, category: v})}>
                          <SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ropa">Ropa y Accesorios</SelectItem>
                            <SelectItem value="tecnologia">Tecnología</SelectItem>
                            <SelectItem value="comida">Comida y Bebida</SelectItem>
                            <SelectItem value="hogar">Hogar</SelectItem>
                            <SelectItem value="otros">Otros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5"><Label>Teléfono / WhatsApp</Label><Input value={formData.phone} onChange={e => setForm({...formData, phone: e.target.value})} placeholder="51987654321" /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Ciudad</Label><Input value={formData.city} onChange={e => setForm({...formData, city: e.target.value})} placeholder="Ej: Lima" /></div>
                  </CardContent>
                </>
              )}

              {currentStep === 2 && (
                <>
                  <CardHeader>
                    <CardTitle>Tu Diseño</CardTitle>
                    <CardDescription>Elige un template oficial para comenzar.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label>Nombre de la tienda</Label><Input value={formData.storeName} onChange={e => setForm({...formData, storeName: e.target.value})} placeholder="Ej: Mi Tienda" /></div>
                      <div className="space-y-1.5">
                        <Label>Enlace deseado (URL)</Label>
                        <div className="flex items-center gap-2">
                          <Input value={formData.slug} onChange={e => handleSlugChange(e.target.value)} placeholder="mi-tienda" />
                          <span className="text-slate-400 font-bold text-xs">.shoply.app</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Elige un diseño base</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {TemplateRegistry.getAll().map(t => (
                          <button
                            key={t.metadata.id}
                            onClick={() => setForm({...formData, template: t.metadata.id})}
                            className={cn(
                              "flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all",
                              formData.template === t.metadata.id ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-slate-100 hover:border-slate-200 bg-white"
                            )}
                          >
                            <div className="aspect-square w-full rounded-lg overflow-hidden bg-slate-100">
                               <img src={t.metadata.previewImageUrl} alt={t.metadata.name} className="w-full h-full object-cover" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-tight truncate w-full text-center">{t.metadata.slug}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </>
              )}

              {currentStep === 3 && (
                <>
                  <CardHeader>
                    <CardTitle>Elige tu Plan</CardTitle>
                    <CardDescription>Escoge el plan que mejor se adapte a tus necesidades.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid sm:grid-cols-2 gap-4">
                    {[
                      { code: "FREE", name: "Gratis", price: "0", desc: "Hasta 10 productos" },
                      { code: "PRO", name: "Profesional", price: "49", desc: "Productos ilimitados" },
                    ].map(p => (
                      <button key={p.code} onClick={() => setForm({...formData, planCode: p.code})} className={`p-4 border rounded-xl text-left transition-all ${formData.planCode === p.code ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-slate-200"}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-900">{p.name}</span>
                          <span className="text-sm font-bold text-primary">${p.price}/mes</span>
                        </div>
                        <p className="text-xs text-slate-500">{p.desc}</p>
                      </button>
                    ))}
                    <div className="sm:col-span-2 bg-slate-50 p-4 rounded-lg border border-slate-100 text-xs text-slate-500 italic">
                      Nota: Para planes de pago, serás redirigido a la pasarela tras confirmar el registro. El plan FREE se activa instantáneamente.
                    </div>
                  </CardContent>
                </>
              )}

              {currentStep === 4 && (
                <div className="py-12 px-6 text-center space-y-6">
                  <div className="mx-auto size-20 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="size-12 text-emerald-600" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">¡Tienda Creada!</h2>
                    <p className="text-slate-500">Hemos enviado un código de verificación a tu correo para activar tu cuenta.</p>
                  </div>
                  <div className="bg-slate-50 border rounded-xl p-6 text-left max-w-sm mx-auto">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tu dirección pública:</p>
                    <p className="text-primary font-bold text-lg">{formData.slug}.shoply.app</p>
                  </div>
                  <Button className="w-full" size="lg" onClick={() => navigate("/login")}>Ir a Iniciar Sesión</Button>
                </div>
              )}

              {currentStep < 4 && (
                <CardFooter className="flex justify-between gap-4 border-t pt-6">
                  {currentStep > 0 ? (
                    <Button variant="ghost" onClick={back} disabled={isBusy}><ArrowLeft className="size-4 mr-2" /> Atrás</Button>
                  ) : (
                    <div />
                  )}
                  {currentStep === 3 ? (
                    <Button onClick={handleSubmit} disabled={isBusy} className="min-w-32 shadow-lg shadow-primary/25">
                      {isBusy ? <Loader2 className="animate-spin size-4" /> : "Confirmar y Crear"}
                    </Button>
                  ) : (
                    <Button onClick={next} className="min-w-32">Siguiente <ArrowRight className="size-4 ml-2" /></Button>
                  )}
                </CardFooter>
              )}
            </motion.div>
          </AnimatePresence>
        </Card>

        {currentStep < 4 && (
          <p className="mt-8 text-center text-sm text-slate-500">
            ¿Ya tienes una cuenta? <button className="text-primary font-bold hover:underline" onClick={() => navigate("/login")}>Ingresa aquí</button>
          </p>
        )}
      </div>
    </div>
  );
}
