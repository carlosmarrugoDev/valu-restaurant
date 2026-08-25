"use client";

import { useState, useEffect } from "react";
import {
  Check,
  X,
  Clock,
  Users,
  Loader2,
  Edit2,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/auth-context";
import { toast } from "sonner";
import { currencyDetailed } from "@/lib/data";

export function QRConfirmacion() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPedidos();
    const interval = setInterval(loadPedidos, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Sonido de notificación cuando llega un pedido nuevo
  useEffect(() => {
    if (pedidos.length > 0) {
      const audio = new Audio("/sounds/notification.mp3");
      audio.play().catch(() => {
        // El navegador bloquea audio sin interacción previa, ignorar
      });
      
      // Notificación de escritorio si está permitida
      if (Notification.permission === "granted") {
        new Notification("Nuevo pedido QR", {
          body: `Mesa ${pedidos[0].mesa_nombre || 'sin nombre'} ha realizado un pedido.`,
          icon: "/favicon.ico"
        });
      }
    }
  }, [pedidos.length]);

  const loadPedidos = async () => {
    try {
      const res = await fetch("/api/pedidos?estado=pendiente_confirmacion");
      const data = await res.json();
      if (res.ok) {
        // Filtrar solo los pedidos asignados a este mesero
        const misPedidos = (data.pedidos || []).filter(
          (p: any) => p.mesero_id === user?.id,
        );
        setPedidos(misPedidos);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const confirmarPedido = async (pedidoId: string) => {
    try {
      const res = await fetch(`/api/pedidos?id=${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "en_cocina" }),
      });
      if (res.ok) {
        toast.success("✅ Pedido confirmado y enviado a cocina");
        await loadPedidos();
      }
    } catch {
      toast.error("Error al confirmar");
    }
  };

  const rechazarPedido = async (pedidoId: string) => {
    const motivo = prompt("Motivo del rechazo (Obligatorio):");
    if (!motivo || motivo.trim().length < 3) {
      toast.error("Debes indicar un motivo válido para rechazar el pedido");
      return;
    }
    try {
      const res = await fetch(`/api/pedidos?id=${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "cancelado",
          motivo: motivo,
          notas: `Rechazado: ${motivo}`,
        }),
      });
      if (res.ok) {
        toast.info(`Pedido rechazado: ${motivo}`);
        await loadPedidos();
      }
    } catch {
      toast.error("Error al rechazar");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Check className="size-12 mx-auto mb-4 opacity-30" />
        <p className="font-medium">No hay pedidos pendientes de confirmar</p>
        <p className="text-sm">
          Los pedidos de QR aparecerán aquí automáticamente
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {pedidos.map((pedido) => {
        const items = pedido.items || [];
        const total = items.reduce(
          (s: number, i: any) => s + i.precio_unitario * i.cantidad,
          0,
        );
        const minutosTranscurridos = Math.floor(
          (Date.now() - new Date(pedido.fecha_creacion).getTime()) / 60000,
        );
        const esCritico = minutosTranscurridos >= 3;

        return (
          <Card
            key={pedido.id}
            className={`border-2 transition-colors ${
              esCritico
                ? "border-destructive bg-destructive/5 animate-pulse"
                : "border-yellow-500/30 bg-yellow-500/5"
            }`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className={`size-4 ${esCritico ? "text-destructive" : "text-yellow-500"}`} />
                  {pedido.mesa_nombre || `Mesa #${pedido.mesa_id}`}
                </CardTitle>
                <Badge
                  variant={esCritico ? "destructive" : "outline"}
                  className={!esCritico ? "text-yellow-500 border-yellow-500/30" : ""}
                >
                  <Clock className="size-3 mr-1" />
                  {esCritico ? "¡URGENTE!" : "QR pendiente"}
                </Badge>
              </div>
              <CardDescription>
                {items.length} items · Hace {minutosTranscurridos} min
                {esCritico && (
                  <span className="block text-[10px] font-bold text-destructive mt-1 uppercase">
                    Escalando a gerencia...
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                {items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      {item.cantidad}× {item.nombre_producto}
                    </span>
                    <span className="text-muted-foreground">
                      {currencyDetailed(item.precio_unitario * item.cantidad)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="font-bold">Total</span>
                <span className="font-bold text-primary">
                  {currencyDetailed(total)}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => confirmarPedido(pedido.id)}
                >
                  <Check className="size-4 mr-1" />
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => rechazarPedido(pedido.id)}
                >
                  <X className="size-4 mr-1" />
                  Rechazar
                </Button>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  // Editar pedido - abrir modal
                }}
              >
                <Edit2 className="size-3 mr-1" />
                Editar pedido
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
