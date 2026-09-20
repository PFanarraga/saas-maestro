import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useApi } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Send, CheckCircle2, XCircle, Clock,
  User, ShieldCheck, MoreVertical, Paperclip, Loader2
} from "lucide-react";
import { formatDateTime } from "@/lib/utils-shared";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { request, isLoading } = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTicket = async () => {
    const { data: ticketData } = await request<any>(`/platform/support/tickets/${id}`);
    if (ticketData) setData(ticketData);
  };

  useEffect(() => { fetchTicket(); }, [id, request]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [data?.messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    const { error } = await request(`/platform/support/tickets/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ message: reply.trim() })
    });
    if (error) toast.error(error);
    else { setReply(""); fetchTicket(); }
    setBusy(false);
  };

  const handleStatus = async (status: string) => {
    const { error } = await request(`/platform/support/tickets/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    if (error) toast.error(error);
    else { toast.success(`Ticket ${status}`); fetchTicket(); }
  };

  if (isLoading && !data) return <div className="p-8 text-center animate-pulse text-slate-400">Cargando conversación...</div>;
  if (!data) return <div className="p-8 text-center text-rose-500">Ticket no encontrado</div>;

  const { ticket, messages } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/support")} className="text-slate-500 font-bold text-xs uppercase tracking-widest">
          <ArrowLeft className="size-3.5 mr-2" /> Volver al centro
        </Button>
        <div className="flex items-center gap-2">
           {ticket.status !== 'closed' && (
             <Button variant="outline" size="sm" onClick={() => handleStatus('resolved')} className="h-8 text-[10px] font-bold text-emerald-600 border-emerald-100 hover:bg-emerald-50">
               <CheckCircle2 className="size-3.5 mr-1.5" /> MARCAR RESUELTO
             </Button>
           )}
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8"><MoreVertical className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                 <DropdownMenuItem onClick={() => handleStatus('open')}>Reabrir ticket</DropdownMenuItem>
                 <DropdownMenuItem onClick={() => handleStatus('closed')} className="text-rose-600 font-bold">Cerrar ticket</DropdownMenuItem>
              </DropdownMenuContent>
           </DropdownMenu>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 h-[70vh]">
         {/* Main Chat Area */}
         <Card className="lg:col-span-2 flex flex-col border-none shadow-sm shadow-slate-200 overflow-hidden">
            <CardHeader className="border-b bg-white/50 py-4 px-6">
               <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-primary tracking-tighter">TK-{ticket.ticketNumber}</span>
                     <CardTitle className="text-base font-bold text-slate-900">{ticket.subject}</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-bold uppercase border-slate-200 bg-white">
                    {ticket.category}
                  </Badge>
               </div>
            </CardHeader>
            <CardContent ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 scrollbar-hide">
               {messages.map((m: any) => {
                 const isAdmin = m.senderType === 'admin';
                 return (
                   <div key={m.id} className={cn("flex flex-col", isAdmin ? "items-end" : "items-start")}>
                      <div className={cn(
                        "max-w-[85%] rounded-2xl p-4 shadow-sm",
                        isAdmin ? "bg-slate-900 text-white" : "bg-white text-slate-800 border border-slate-100"
                      )}>
                        <div className="flex items-center gap-2 mb-2 opacity-50">
                           {isAdmin ? <ShieldCheck className="size-3" /> : <User className="size-3" />}
                           <span className="text-[9px] font-bold uppercase tracking-widest">{m.senderName || m.senderEmail}</span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.message}</p>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 mt-1.5 px-1 uppercase tracking-tight">
                        {formatDateTime(m.createdAt)}
                      </span>
                   </div>
                 );
               })}
            </CardContent>
            <CardFooter className="border-t p-4 bg-white">
               <form onSubmit={handleSend} className="flex gap-2 w-full">
                  <div className="relative flex-1">
                    <Textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder="Escribe tu respuesta..."
                      className="min-h-[44px] h-[44px] resize-none pr-10 pt-3 text-sm border-slate-200 bg-slate-50 focus:bg-white transition-colors"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                      }}
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-8 text-slate-400 hover:text-primary">
                       <Paperclip className="size-4" />
                    </Button>
                  </div>
                  <Button type="submit" disabled={busy || !reply.trim()} className="h-[44px] px-6 shadow-lg shadow-primary/20">
                     {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
               </form>
            </CardFooter>
         </Card>

         {/* Sidebar Info */}
         <div className="space-y-6">
            <Card className="border-none shadow-sm shadow-slate-200">
               <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Información del Cliente</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4 pt-2">
                  <div className="flex items-center gap-3">
                     <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                       {ticket.userName?.charAt(0) ?? "?"}
                     </div>
                     <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-900 truncate">{ticket.userName || "Sin nombre"}</span>
                        <span className="text-[10px] text-slate-400 font-bold truncate tracking-tight">{ticket.userEmail}</span>
                     </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tienda Relacionada</span>
                        <Badge variant="outline" className="text-[9px] uppercase tracking-tighter bg-slate-50">{ticket.tenantName || "Ninguna"}</Badge>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prioridad</span>
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">{ticket.priority}</span>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-none shadow-sm shadow-slate-200 bg-slate-900 text-white">
               <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                  <Clock className="size-8 text-primary" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tiempo transcurrido</p>
                    <p className="text-xl font-bold">42m 12s</p>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">Asegúrate de responder antes de que se cumpla el SLA de 2 horas.</p>
               </CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}
