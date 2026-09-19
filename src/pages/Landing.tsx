import { Link } from "react-router";
import { useEffect, useState } from "react";
import { useApi } from "@/hooks/use-api";
import { motion } from "framer-motion";
import { ArrowRight, Building2, CheckCircle2, Globe, MessageCircle, Palette, ShieldCheck, ShoppingCart, Store, Layers, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Landing() {
  const { request } = useApi();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    request<any>("/public/stats").then(({ data }) => setStats(data));
  }, [request]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Shoply Logo" className="size-8 rounded-lg object-cover" />
            <span className="font-bold tracking-tight">Shoply</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Funciones</a>
            <a href="#how" className="hover:text-foreground transition-colors">Cómo funciona</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Precios</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/auth">Ingresar</Link></Button>
            <Button size="sm" asChild><Link to="/auth">Empezar gratis <ArrowRight className="size-4 ml-1" /></Link></Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,--theme(--color-primary/8%),transparent)]" />
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]"
          >
            Crea tu tienda online
            <span className="block text-primary">en minutos, no en meses</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-5 max-w-2xl text-muted-foreground text-base sm:text-lg"
          >
            Shoply es la plataforma multi-tenant donde cada tienda tiene su propio diseño,
            catálogo, pedidos, delivery, cupones, WhatsApp y pagos — todo gestionado desde un solo panel.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button size="lg" asChild><Link to="/auth">Crear mi tienda <ArrowRight className="size-4 ml-1" /></Link></Button>
            <Button size="lg" variant="outline" asChild><a href="#demo">Ver tiendas demo</a></Button>
          </motion.div>
          <p className="mt-4 text-xs text-muted-foreground">Sin tarjeta de crédito · Checkout como invitado · WhatsApp integrado</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Todo lo que tu tienda necesita</h2>
            <p className="mt-2 text-muted-foreground">Herramientas profesionales, simples de usar.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Palette, title: "Theme Engine", desc: "Colores, tipografía, logo y bloques de página con borrador y publicación. Cada tienda se ve como quiere." },
              { icon: Layers, title: "Catálogo y variantes", desc: "Productos con opciones (color, talla), stock por variante, categorías jerárquicas e inventario." },
              { icon: ShoppingCart, title: "Checkout como invitado", desc: "Carrito, cupones, delivery por zonas y pedidos sin fricción ni registro." },
              { icon: MessageCircle, title: "WhatsApp nativo", desc: "Botones de consulta y compra por WhatsApp con mensajes generados automáticamente." },
              { icon: ShieldCheck, title: "Aislamiento por tienda", desc: "Arquitectura multi-tenant con RBAC: cada tienda solo ve sus datos. Audit log completo." },
              { icon: Truck, title: "Pagos y delivery", desc: "Links de pago (Culqi o manual), zonas de delivery con tarifas y estados de pedido completos." },
            ].map((f) => (
              <Card key={f.title} className="border-border/70">
                <CardContent className="pt-5">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t bg-muted/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">De cero a vendiendo en 4 pasos</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "1", title: "Crea tu cuenta", desc: "Regístrate con tu email y código de verificación." },
              { n: "2", title: "Personaliza tu tienda", desc: "Elige plantilla, colores y arma tu página con bloques." },
              { n: "3", title: "Carga tu catálogo", desc: "Productos, variantes, stock, categorías y cupones." },
              { n: "4", title: "Vende y gestiona", desc: "Recibe pedidos, cobra por WhatsApp y sigue tus métricas." },
            ].map((s) => (
              <div key={s.n} className="relative rounded-xl border bg-background p-5">
                <span className="absolute -top-3 left-5 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{s.n}</span>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo stores */}
      <section id="demo" className="border-t py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tiendas demo</h2>
            <p className="mt-2 text-muted-foreground">Explora tiendas reales construidas con la plataforma.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { slug: "aurora-tech", name: "Aurora Tech", tag: "Tecnología", style: "Minimal" },
              { slug: "cafe-verduras", name: "Café Verduras", tag: "Frescos", style: "Clásica" },
              { slug: "velvet-moda", name: "Vélvet Moda", tag: "Moda", style: "Vibrante" },
            ].map((s) => (
              <a
                key={s.slug}
                href={`/t/${s.slug}`}
                className="group rounded-xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-lg">
                  {s.name.charAt(0)}
                </div>
                <h3 className="font-semibold group-hover:text-primary transition-colors">{s.name}</h3>
                <p className="text-sm text-muted-foreground">{s.tag} · Plantilla {s.style}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Visitar tienda <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </a>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Si las tiendas demo aún no existen, entra como Super Admin y pulsa "Datos demo".
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t bg-muted/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Planes simples</h2>
            <p className="mt-2 text-muted-foreground">Empieza gratis, crece cuando lo necesites.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { code: "FREE", price: "S/ 0", features: ["10 productos", "1 usuario", "WhatsApp", "Tema personalizable"] },
              { code: "BASIC", price: "S/ 69", features: ["50 productos", "2 usuarios", "Cupones", "Analytics básico"], highlight: true },
              { code: "PRO", price: "S/ 179", features: ["300 productos", "5 usuarios", "Dominio propio", "Analytics avanzado"] },
              { code: "BUSINESS", price: "S/ 359", features: ["2000 productos", "15 usuarios", "API access", "Soporte prioritario"] },
            ].map((p) => (
              <Card key={p.code} className={p.highlight ? "border-primary shadow-md relative" : "relative"}>
                {p.highlight && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">Popular</Badge>}
                <CardContent className="pt-6 text-center">
                  <p className="text-sm font-medium text-muted-foreground">{p.code}</p>
                  <p className="mt-1 text-3xl font-extrabold">{p.price}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
                  <ul className="mt-4 space-y-2 text-sm text-left">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2"><CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />{f}</li>
                    ))}
                  </ul>
                  <Button className="mt-5 w-full" variant={p.highlight ? "default" : "outline"} asChild>
                    <Link to="/auth">Elegir plan</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">¿Listo para lanzar tu tienda?</h2>
          <p className="mt-2 text-muted-foreground">Crea tu cuenta y ten tu tienda pública hoy mismo.</p>
          <Button size="lg" className="mt-6" asChild><Link to="/auth">Empezar ahora <ArrowRight className="size-4 ml-1" /></Link></Button>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Building2 className="size-3.5" /> Shoply — Plataforma de comercio multi-tienda
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1"><Globe className="size-3.5" /> Multi-tenant</span>
            <span>{stats ? `${stats.activeTenants} tiendas activas` : "SaaS de comercio"}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
