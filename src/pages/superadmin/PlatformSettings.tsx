import { useState, useEffect } from "react";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Settings, Globe, Shield, Store, ShoppingCart,
  Bell, Database, Save, Loader2, Info
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function PlatformSettings() {
  const { request, isLoading } = useApi();
  const [settings, setSettings] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const fetchSettings = async () => {
    const { data } = await request<any[]>("/platform/settings");
    if (data) setSettings(data);
  };

  useEffect(() => { fetchSettings(); }, [request]);

  const updateSetting = async (key: string, value: any) => {
    const { error } = await request("/platform/settings", {
      method: "POST",
      body: JSON.stringify({ key, value })
    });
    if (error) toast.error(error);
    else { toast.success(`Ajuste '${key}' actualizado`); fetchSettings(); }
  };

  const getVal = (key: string, def: any = "") => {
    return settings.find(s => s.key === key)?.value ?? def;
  };

  const SETTING_GROUPS = [
    {
      id: "general",
      title: "General",
      icon: Globe,
      items: [
        { key: "platform_name", label: "Nombre de la Plataforma", type: "text", desc: "Se usa en correos y títulos." },
        { key: "support_email", label: "Email de Soporte", type: "text", desc: "Remitente para notificaciones." },
        { key: "base_currency", label: "Moneda Predeterminada", type: "text", desc: "PEN, USD, etc." },
      ]
    },
    {
      id: "registration",
      title: "Registro y Tiendas",
      icon: Store,
      items: [
        { key: "allow_public_registration", label: "Permitir nuevos registros", type: "switch", desc: "Habilita el formulario /register." },
        { key: "allow_free_plan", label: "Permitir plan FREE", type: "switch", desc: "Habilita la opción gratuita en el wizard." },
        { key: "require_email_verification", label: "Requerir verificación", type: "switch", desc: "Obliga OTP en el primer login." },
      ]
    },
    {
      id: "infrastructure",
      title: "Plataforma y Seguridad",
      icon: Shield,
      items: [
        { key: "maintenance_mode", label: "Modo Mantenimiento", type: "switch", desc: "Bloquea el acceso a clientes y tiendas." },
        { key: "maintenance_message", label: "Mensaje de Mantenimiento", type: "text", desc: "Se muestra en la pantalla de bloqueo." },
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Configuración Global</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">Control técnico de Shoply y sus subsistemas.</p>
      </div>

      <div className="grid gap-8">
        {SETTING_GROUPS.map((group) => (
          <div key={group.id} className="space-y-4">
             <div className="flex items-center gap-2 px-1">
                <group.icon className="size-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{group.title}</h3>
             </div>

             <Card className="border-none shadow-sm shadow-slate-200 bg-white">
                <CardContent className="p-0 divide-y divide-slate-100">
                   {group.items.map((item) => (
                     <div key={item.key} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                        <div className="space-y-1 max-w-md">
                           <Label className="text-sm font-bold text-slate-900">{item.label}</Label>
                           <p className="text-xs text-slate-500 leading-normal">{item.desc}</p>
                        </div>
                        <div className="flex items-center gap-3">
                           {item.type === 'switch' ? (
                             <Switch
                               checked={getVal(item.key, false)}
                               onCheckedChange={(checked) => updateSetting(item.key, checked)}
                             />
                           ) : (
                             <div className="flex gap-2">
                               <Input
                                 defaultValue={getVal(item.key)}
                                 onBlur={(e) => {
                                   const val = e.target.value;
                                   if (val !== getVal(item.key)) updateSetting(item.key, val);
                                 }}
                                 className="h-9 text-sm bg-slate-50 border-slate-200 min-w-[200px]"
                               />
                             </div>
                           )}
                        </div>
                     </div>
                   ))}
                </CardContent>
             </Card>
          </div>
        ))}

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4">
           <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
           <div className="text-xs text-blue-800 leading-relaxed">
             <p className="font-bold mb-1">Sobre la Seguridad de Credenciales</p>
             <p>Las API Keys de Stripe, Culqi o Resend no se gestionan desde este panel por seguridad. Deben ser configuradas directamente en el <b>Secret Manager de Supabase</b>.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
