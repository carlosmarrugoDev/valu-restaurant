"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  ShoppingCart,
  ArrowLeft,
  Bell,
  RefreshCw,
  Search,
  ChefHat,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
} from "lucide-react";

const IVA = 0.16;
const metodosPago = ["Efectivo", "Tarjeta", "Nequi", "Daviplata"];

type EstadoPedido =
  | "pendiente_pago"
  | "en_espera_cocina"
  | "en_cocina"
  | "en_preparacion"
  | "listo"
  | "entregado"
  | "pagado"
  | "cancelado";

const ESTADOS_ACTIVOS: EstadoPedido[] = [
  "pendiente_pago",
  "en_espera_cocina",
  "en_cocina",
  "en_preparacion",
  "listo",
];

const BARRA = [
  { key: "pagado", label: "PAGADO", fase: 1 as const },
  { key: "cocina", label: "COCINA", fase: 2 as const },
  { key: "listo", label: "LISTO", fase: 3 as const },
  { key: "entregado", label: "ENTREGADO", fase: 4 as const },
];

function getFase(estado: EstadoPedido): number {
  switch (estado) {
    case "pendiente_pago":
      return 0;
    case "en_espera_cocina":
      return 1;
    case "en_cocina":
    case "en_preparacion":
      return 2;
    case "listo":
      return 3;
    case "entregado":
      return 4;
    default:
      return 0;
  }
}

function getEstadoLabel(estado: EstadoPedido, cocinero?: string | null) {
  switch (estado) {
    case "pendiente_pago":
      return { label: "Confirmando pago", color: "text-yellow-600" };
    case "en_espera_cocina":
      return { label: "En cola de cocina", color: "text-blue-600" };
    case "en_cocina":
    case "en_preparacion":
      return {
        label: cocinero ? `Preparandolo ${cocinero}` : "En preparacion",
        color: "text-amber-700",
      };
    case "listo":
      return { label: "Listo para reclamar", color: "text-green-600" };
    case "entregado":
      return { label: "Entregado", color: "text-green-700" };
    case "pagado":
      return { label: "Pagado y cerrado", color: "text-green-700" };
    case "cancelado":
      return { label: "Cancelado", color: "text-destructive" };
    default:
      return { label: estado, color: "text-muted-foreground" };
  }
}

function ClientPageContent() {
  const searchParams = useSearchParams();
  const mesa = searchParams.get("mesa");
  const mesaUuid = searchParams.get("mid");
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [categoria, setCategoria] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [mesaId, setMesaId] = useState<string | null>(null);
  const [mesaNombre, setMesaNombre] = useState<string>("");
  const [enviando, setEnviando] = useState(false);
  const [mesaEncontrada, setMesaEncontrada] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [verPago, setVerPago] = useState(false);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [pagando, setPagando] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [sesionClienteId, setSesionClienteId] = useState<string>("");
  const [avisoSesionOtroPedido, setAvisoSesionOtroPedido] = useState(false);

  const [pedidoActivo, setPedidoActivo] = useState<any | null>(null);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState<number>(0);
  const [verEstadoPedido, setVerEstadoPedido] = useState(false);
  const [ultimoEstado, setUltimoEstado] = useState<string>("");
  const [pedidoCerradoAuto, setPedidoCerradoAuto] = useState(false);

  const pedidoActivoRef = useRef<any>(null);
  const vibradoRef = useRef<boolean>(false);
  const listoNotificadoRef = useRef<boolean>(false);

  useEffect(() => {
    let sid = sessionStorage.getItem("sesion_cliente_id");
    if (!sid) {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      sid = "cli_" + Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem("sesion_cliente_id", sid);
    }
    setSesionClienteId(sid);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const slug = mesa || sessionStorage.getItem("mesa_cliente");
    const mid = mesaUuid || sessionStorage.getItem("mesa_cliente_id");
    if (mesa) sessionStorage.setItem("mesa_cliente", mesa);
    if (mesaUuid) sessionStorage.setItem("mesa_cliente_id", mesaUuid);
    if (slug) {
      setMesaId(slug);
      setMesaNombre(slug.replace(/-/g, " "));
    }
    loadData(slug, mid);
  }, [mesa, mesaUuid]);

  useEffect(() => {
    if (!mesaId || !mesaEncontrada) return;
    let isMounted = true;

    const verificarPedido = async () => {
      if (!isMounted) return;
      try {
        const storedId = pedidoActivoRef.current?.id || sessionStorage.getItem("pedido_cliente_id");
        const qs = new URLSearchParams();
        if (storedId) qs.set("id", storedId);
        qs.set("mesa_id", mesaEncontrada.id);
        if (sesionClienteId) qs.set("cliente_sesion", sesionClienteId);
        const pedidosRes = await fetch(`/api/cliente/pedidos?${qs.toString()}`);
        const pedidosData = await pedidosRes.json();
        const pedidos = pedidosData.pedidos || [];
        const pedidoServidor = pedidosData.pedido || null;

        const activos = pedidos.filter((p: any) =>
          ESTADOS_ACTIVOS.includes(p.estado),
        );

        const storedPedido = storedId ? activos.find((p: any) => p.id === storedId) : null;

        if (storedPedido) {
          const segundos = Math.floor(
            (Date.now() - new Date(storedPedido.fecha_creacion).getTime()) / 1000,
          );

          const cambioEstado =
            pedidoActivoRef.current?.estado !== storedPedido.estado;

          if (
            cambioEstado &&
            storedPedido.estado === "listo" &&
            !listoNotificadoRef.current
          ) {
            listoNotificadoRef.current = true;
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200, 100, 400]);
            }
            if (
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              new Notification("Tu pedido esta listo", {
                body: `Mesa ${mesaNombre} - Acercate al mostrador o espera en tu mesa`,
                icon: "/icon.png",
              });
            }
          }

          pedidoActivoRef.current = storedPedido;
          setPedidoActivo(storedPedido);
          sessionStorage.setItem("pedido_cliente_id", storedPedido.id);
          setTiempoTranscurrido(segundos);
          setUltimoEstado(storedPedido.estado);
          setPedidoCerradoAuto(false);
          setAvisoSesionOtroPedido(false);
          setVerEstadoPedido(true);
        } else if (storedId && !storedPedido && (
          pedidoServidor &&
          ["entregado", "pagado", "cancelado"].includes(pedidoServidor.estado)
        )) {
          pedidoActivoRef.current = null;
          setPedidoActivo(null);
          sessionStorage.removeItem("pedido_cliente_id");
          setUltimoEstado("");
          setAvisoSesionOtroPedido(false);
          if (verEstadoPedido) {
            setPedidoCerradoAuto(true);
            setTimeout(() => {
              setVerEstadoPedido(false);
              setPedidoCerradoAuto(false);
              listoNotificadoRef.current = false;
            }, 4000);
          }
        } else if (storedId && !storedPedido && pedidoActivoRef.current && ESTADOS_ACTIVOS.includes(pedidoActivoRef.current.estado)) {
          return;
        } else if (storedId && !storedPedido) {
          pedidoActivoRef.current = null;
          setPedidoActivo(null);
          sessionStorage.removeItem("pedido_cliente_id");
          setUltimoEstado("");
          setAvisoSesionOtroPedido(false);
          if (verEstadoPedido) {
            setPedidoCerradoAuto(true);
            setTimeout(() => {
              setVerEstadoPedido(false);
              setPedidoCerradoAuto(false);
              listoNotificadoRef.current = false;
            }, 4000);
          }
        } else if (!storedId && activos.length > 0) {
          setAvisoSesionOtroPedido(true);
          pedidoActivoRef.current = null;
          setPedidoActivo(null);
        } else {
          pedidoActivoRef.current = null;
          setPedidoActivo(null);
          sessionStorage.removeItem("pedido_cliente_id");
          setUltimoEstado("");
          setAvisoSesionOtroPedido(false);
          if (verEstadoPedido) {
            setPedidoCerradoAuto(true);
            setTimeout(() => {
              setVerEstadoPedido(false);
              setPedidoCerradoAuto(false);
              listoNotificadoRef.current = false;
            }, 4000);
          }
        }
      } catch (error) {
        console.error("Error verificando pedido:", error);
      }
    };

    verificarPedido();
    const interval = setInterval(verificarPedido, 3000);
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [mesaId, mesaEncontrada, verEstadoPedido, mesaNombre, sesionClienteId]);

  useEffect(() => {
    if (!pedidoActivo) return;
    if (["pagado", "cancelado", "entregado"].includes(pedidoActivo.estado)) return;

    const timer = setInterval(() => {
      if (pedidoActivo.fecha_creacion) {
        const segundos = Math.floor(
          (Date.now() - new Date(pedidoActivo.fecha_creacion).getTime()) / 1000,
        );
        setTiempoTranscurrido(segundos);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [pedidoActivo]);

  const loadData = async (slug?: string | null, mid?: string | null) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (slug) qs.set("mesa", slug);
      if (mid) qs.set("mid", mid);
      const res = await fetch(`/api/cliente/menu?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar el menu");
      }
      if (data.mesa) {
        setMesaEncontrada(data.mesa);
        setMesaId(data.mesa.id);
        setMesaNombre(data.mesa.nombre);
        sessionStorage.setItem("mesa_cliente_id", data.mesa.id);
      }
      const prods = data.productos || [];
      const cats = data.categorias || [];
      setProductos(prods);
      setCategorias(cats);
      if (cats.length > 0) setCategoria(cats[0].id);

      const storedPedidoId = sessionStorage.getItem("pedido_cliente_id");
      if (storedPedidoId && data.mesa?.id) {
        const pedidoRes = await fetch(`/api/cliente/pedidos?id=${storedPedidoId}&mesa_id=${data.mesa.id}&cliente_sesion=${sesionClienteId || ''}`);
        const pedidoData = await pedidoRes.json();
        const pedido = pedidoData.pedido;
        if (pedido && ESTADOS_ACTIVOS.includes(pedido.estado)) {
          pedidoActivoRef.current = pedido;
          setPedidoActivo(pedido);
          setAvisoSesionOtroPedido(false);
          setVerEstadoPedido(true);
        } else {
          sessionStorage.removeItem("pedido_cliente_id");
          if (pedidoData.pedidos && pedidoData.pedidos.some((p: any) => ESTADOS_ACTIVOS.includes(p.estado))) {
            setAvisoSesionOtroPedido(true);
          }
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (p: any) => {
    if (!mesaId) {
      alert("No se detecto la mesa. Escanea el QR nuevamente.");
      return;
    }
    if (!p.disponible || (p.stock_calculado ?? 999) <= 0) {
      alert("Este producto esta agotado.");
      return;
    }
    if (pedidoActivo && ESTADOS_ACTIVOS.includes(pedidoActivo.estado)) {
      alert(
        `Ya tienes un pedido activo. Espera a que sea atendido o cancela el anterior.`,
      );
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === p.id);
      const maxPermitido = p.stock_calculado ?? 99;
      if (existing) {
        if (existing.cantidad >= maxPermitido) {
          alert(
            `No puedes agregar mas unidades de ${p.nombre}. Solo quedan ${maxPermitido} disponibles.`,
          );
          return prev;
        }
        return prev.map((i) =>
          i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      }
      return [...prev, { ...p, cantidad: 1 }];
    });
  };

  const updateCantidad = (id: string, delta: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      const nueva = item.cantidad + delta;
      if (nueva <= 0) return prev.filter((i) => i.id !== id);
      const max = item.stock_calculado ?? 99;
      if (nueva > max) {
        alert(
          `Solo puedes agregar hasta ${max} de ${item.nombre}. Stock limitado.`,
        );
        return prev;
      }
      return prev.map((i) => (i.id === id ? { ...i, cantidad: nueva } : i));
    });
  };

  const enviarPedido = () => {
    if (!mesaId || !mesaEncontrada) return alert("No se detecto la mesa");
    if (cart.length === 0) return alert("Agrega productos");
    setVerPago(true);
  };

  const confirmarPago = async () => {
    if (cart.length === 0) return;
    setPagando(true);
    setStockLoading(true);
    try {
      const pedidoRes = await fetch("/api/cliente/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesa_id: mesaEncontrada.id,
          metodo_pago: metodoPago,
          items: cart.map((item) => ({
            producto_id: item.id,
            cantidad: item.cantidad,
            precio: item.precio,
          })),
        }),
      });
      if (!pedidoRes.ok) {
        const errData = await pedidoRes.json();
        throw new Error(errData.error || "No se pudo crear el pedido");
      }
      const { pedido } = await pedidoRes.json();
      if (!pedido || !pedido.id) {
        throw new Error("Respuesta incompleta del servidor. Intenta de nuevo.");
      }
      pedidoActivoRef.current = pedido;
      setPedidoActivo(pedido);
      sessionStorage.setItem("pedido_cliente_id", pedido.id);
      setCart([]);
      setVerPago(false);
      setVerEstadoPedido(true);
      setPedidoCerradoAuto(false);
      listoNotificadoRef.current = false;
    } catch (e: any) {
      alert("Error: " + (e.message || "Intenta de nuevo"));
    } finally {
      setPagando(false);
      setStockLoading(false);
    }
  };

  const volverAlMenu = () => {
    if (pedidoActivo && ESTADOS_ACTIVOS.includes(pedidoActivo.estado)) {
      setVerEstadoPedido(false);
      return;
    }
    setVerEstadoPedido(false);
    setPedidoActivo(null);
    pedidoActivoRef.current = null;
    setUltimoEstado("");
    setTiempoTranscurrido(0);
    listoNotificadoRef.current = false;
  };

  const cancelarPedidoActivo = async () => {
    if (!pedidoActivo) return;
    if (!window.confirm("Cancelar tu pedido actual?")) return;
    try {
      const res = await fetch(`/api/cliente/pedidos?id=${pedidoActivo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "cancelado", motivo: "Cliente solicita cancelacion" }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "No se pudo cancelar");
      }
      setPedidoActivo(null);
      pedidoActivoRef.current = null;
      sessionStorage.removeItem("pedido_cliente_id");
      setVerEstadoPedido(false);
      listoNotificadoRef.current = false;
    } catch (e: any) {
      alert(e.message || "Error");
    }
  };

  const subtotalCart = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const ivaCart = subtotalCart * IVA;
  const totalCart = subtotalCart + ivaCart;

  const formatTiempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    if (mins === 0) return `${secs}s`;
    if (mins > 30) return `${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (verEstadoPedido && (pedidoActivo || pedidoCerradoAuto)) {
    if (pedidoCerradoAuto) {
      return (
        <div className="min-h-screen bg-background p-4 md:p-6 flex items-center justify-center">
          <div className="max-w-md w-full text-center space-y-4 border border-border rounded-2xl p-8">
            <CheckCircle2 className="size-16 mx-auto text-green-600" />
            <h2 className="font-display text-xl font-bold">Atencion finalizada</h2>
            <p className="text-muted-foreground text-sm">
              Tu pedido ha sido entregado y cerrado. En breve volvera a aparecer el menu.
            </p>
            <button
              onClick={volverAlMenu}
              className="mt-2 w-full py-3 border border-border rounded-xl hover:bg-muted transition-colors"
            >
              Volver al menu ahora
            </button>
          </div>
        </div>
      );
    }

    const estado = pedidoActivo.estado as EstadoPedido;
    const estadoInfo = getEstadoLabel(estado, pedidoActivo.cocinero_nombre);
    const items = pedidoActivo.items || [];
    const subtotalPedido =
      pedidoActivo.subtotal ??
      items.reduce((s: number, i: any) => s + i.precio_unitario * i.cantidad, 0);
    const ivaPedido = pedidoActivo.impuestos ?? subtotalPedido * IVA;
    const totalPedido = pedidoActivo.total ?? subtotalPedido + ivaPedido;
    const fase = Math.max(1, getFase(estado));
    const porcentaje = fase === 0 ? 0 : (fase / 4) * 100;

    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="bg-white text-black px-6 pt-6 pb-4 rounded-b-[2rem] border-b-8 border-primary">
              <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4">
                <h2 className="font-display text-2xl font-bold uppercase tracking-tight">
                  Comprobante de Pago
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Pedido #{pedidoActivo.numero_pedido || pedidoActivo.id.slice(0, 6)}
                </p>
                <div className="mt-3 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase border bg-primary/10 text-primary">
                  {estadoInfo.label}
                </div>
              </div>

              <div className="space-y-2 mb-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fecha:</span>
                  <span className="font-medium">
                    {new Date(pedidoActivo.fecha_creacion).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mesa:</span>
                  <span className="font-medium">{mesaNombre}</span>
                </div>
                {pedidoActivo.metodo_pago && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Metodo de pago:</span>
                    <span className="font-medium capitalize">
                      {pedidoActivo.metodo_pago}
                    </span>
                  </div>
                )}
                {pedidoActivo.cocinero_nombre && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cocinero:</span>
                    <span className="font-medium">{pedidoActivo.cocinero_nombre}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1">
                  <span className="text-gray-500">Estado:</span>
                  <span className={`font-bold ${estadoInfo.color}`}>
                    {estadoInfo.label}
                  </span>
                </div>
              </div>

              <div className="border-b border-dashed border-gray-300 mb-4" />

              <div className="space-y-2 mb-5">
                {items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>
                      {item.cantidad}x {item.nombre_producto}
                    </span>
                    <span className="font-medium tabular-nums">
                      ${(item.precio_unitario * item.cantidad).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-b border-dashed border-gray-300 mb-4" />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal:</span>
                  <span className="tabular-nums">${subtotalPedido.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>IVA (16%):</span>
                  <span className="tabular-nums">${ivaPedido.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-xl pt-1">
                  <span>Total Pagado</span>
                  <span className="text-primary tabular-nums">
                    ${totalPedido.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400 mb-2 italic">
                  Muestra este comprobante al recibir tu pedido
                </p>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <p className="text-sm font-bold text-gray-600 mb-1 tracking-wide">
                    CODIGO DE RECLAMO
                  </p>
                  <p className="text-3xl font-black tracking-widest text-primary tabular-nums">
                    {pedidoActivo.numero_pedido || pedidoActivo.id.slice(0, 6)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold flex items-center gap-2">
                  <RefreshCw className="size-4 text-muted-foreground" />
                  Seguimiento
                </h3>
                {estado !== "entregado" && estado !== "cancelado" && (
                  <span className="text-sm font-medium flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-4" />
                    {formatTiempo(tiempoTranscurrido)}
                  </span>
                )}
              </div>

              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] mb-2 px-1 tracking-wide">
                  {BARRA.map((b) => {
                    const completado = fase > b.fase
                    const actual = fase === b.fase
                    return (
                      <span
                        key={b.key}
                        className={
                          actual
                            ? "text-primary font-bold scale-110 transition-transform"
                            : completado
                              ? "text-green-600 font-medium"
                              : "text-muted-foreground"
                        }
                      >
                        {b.label}
                      </span>
                    )
                  })}
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-primary rounded-full transition-all duration-700 ease-in-out"
                    style={{ width: `${porcentaje}%` }}
                  />
                  <div className="absolute inset-0 flex justify-between px-1">
                    {BARRA.map((b) => {
                      const completado = fase > b.fase
                      const actual = fase === b.fase
                      return (
                        <div
                          key={b.key}
                          className={`size-3 rounded-full -mt-0.5 ${
                            completado
                              ? "bg-green-600 shadow"
                              : actual
                                ? "bg-primary shadow ring-2 ring-primary/20"
                                : "bg-muted"
                          }`}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 text-sm">
                {estado === "en_espera_cocina" && (
                  <div className="bg-blue-500/10 border border-blue-500/20 text-blue-800 p-3 rounded-xl flex items-start gap-2">
                    <UserCheck className="size-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        Tu pedido esta en cola de cocina
                      </p>
                      <p className="text-xs opacity-80">
                        Esperando a que un cocinero tome tu pedido para
                        comenzar la preparacion.
                      </p>
                    </div>
                  </div>
                )}
                {(estado === "en_preparacion" || estado === "en_cocina") && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 p-3 rounded-xl flex items-start gap-2">
                    <ChefHat className="size-5 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <p className="font-semibold">
                        {pedidoActivo.cocinero_nombre
                          ? `${pedidoActivo.cocinero_nombre} ya esta preparando tu pedido`
                          : "Tu pedido esta en preparacion"}
                      </p>
                      <p className="text-xs opacity-80">
                        En este momento se esta cocinando. Te avisaremos cuando
                        este listo.
                      </p>
                    </div>
                  </div>
                )}
                {estado === "listo" && (
                  <div className="bg-green-600 text-white p-4 rounded-xl shadow-lg">
                    <p className="font-bold text-center">
                      PEDIDO LISTO PARA RECLAMAR
                    </p>
                    <p className="text-xs text-center opacity-90 mt-1">
                      Acercate al mostrador mostrando el comprobante, o espera
                      en tu mesa.
                    </p>
                  </div>
                )}
                {estado === "entregado" && (
                  <div className="bg-green-500/10 border border-green-500/20 text-green-800 p-3 rounded-xl flex items-start gap-2">
                    <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Entregado exitosamente</p>
                      <p className="text-xs opacity-80">
                        Gracias por tu visita. Puedes seguir ordenando desde
                        este mismo QR.
                      </p>
                    </div>
                  </div>
                )}
                {estado === "cancelado" && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-800 p-3 rounded-xl flex items-start gap-2">
                    <XCircle className="size-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Pedido cancelado</p>
                      <p className="text-xs opacity-80">
                        {pedidoActivo.motivo_cancelacion || "Sin detalle"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {estado === "pendiente_pago" && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-800 p-3 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Confirmando tu pago simulado</p>
                    <p className="text-xs opacity-80">
                      Si persiste, regresa al menu y vuelve a intentar.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={volverAlMenu}
                  className="py-3 flex items-center justify-center gap-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="size-4" />
                  Volver al menu
                </button>
                {["en_espera_cocina", "en_cocina", "en_preparacion", "pendiente_pago"].includes(
                  estado,
                ) && (
                  <button
                    onClick={cancelarPedidoActivo}
                    className="py-3 text-sm border border-red-500/40 text-red-600 rounded-xl hover:bg-red-500/5 transition-colors"
                  >
                    Cancelar pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (verPago) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => setVerPago(false)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm"
          >
            <ArrowLeft className="size-4" />
            Volver al carrito
          </button>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
            <h2 className="font-display text-2xl font-bold mb-6 text-center">
              Finalizar Pedido
            </h2>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center p-3 bg-muted rounded-xl">
                <span className="text-muted-foreground text-sm">
                  Subtotal
                </span>
                <span className="tabular-nums">${subtotalCart.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-xl">
                <span className="text-muted-foreground text-sm">IVA (16%)</span>
                <span className="tabular-nums">${ivaCart.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-xl bg-primary/10 border border-primary/20">
                <span className="font-semibold">Total a pagar:</span>
                <span className="text-xl font-bold text-primary tabular-nums">
                  ${totalCart.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Metodo de pago (simulado)
                </label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {metodosPago.map((m) => {
                    const key = m.toLowerCase();
                    const active = metodoPago === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setMetodoPago(key)}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                          active
                            ? "border-primary bg-primary/10 text-primary shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={confirmarPago}
              disabled={pagando || stockLoading}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
            >
              {pagando || stockLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Procesando y verificando stock...
                </>
              ) : (
                <>
                  <CheckCircle className="size-5" />
                  CONFIRMAR Y PAGAR
                </>
              )}
            </button>
            <p className="mt-4 text-[10px] text-center text-muted-foreground uppercase tracking-widest">
              Pago simulado. Los insumos se descuentan en este momento.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const filtered = productos.filter((p) => {
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoria && p.categoria_id !== categoria) return false;
    return p.disponible;
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {isOffline && (
          <div className="p-3 bg-destructive text-white rounded-lg flex items-center gap-2 animate-pulse text-sm font-bold">
            <XCircle className="size-4" />
            Sin conexion. Tu pedido no se enviara hasta restaurarse la red.
          </div>
        )}

        {avisoSesionOtroPedido && (
          <div className="p-4 border border-amber-300/60 bg-amber-500/10 rounded-xl flex items-start gap-3 text-sm">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">
                Esta mesa tiene un pedido activo creado desde otro dispositivo
              </p>
              <p className="text-xs text-amber-700 mt-0.5 opacity-90">
                Por seguridad, no puedes ver ni modificar ese pedido desde este telefono.
                Si es tu pedido, vuelve al celular donde lo creaste. Si deseas ordenar
                algo adicional, puedes hacerlo normalmente y se creara un pedido
                independiente para esta sesion.
              </p>
            </div>
            <button
              onClick={() => setAvisoSesionOtroPedido(false)}
              className="text-amber-700 hover:text-amber-900 text-xs font-medium px-2 py-1 rounded-md hover:bg-amber-500/10 transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Menu</h1>
            {mesaId ? (
              <p className="text-sm text-muted-foreground">
                Mesa: <span className="font-medium text-primary">{mesaNombre}</span>
              </p>
            ) : (
              <p className="text-sm text-destructive">
                No se detecto la mesa. Escanea el QR nuevamente.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {productos.length} platillos
            </span>
            {pedidoActivo && ESTADOS_ACTIVOS.includes(pedidoActivo.estado) && (
              <button
                onClick={() => setVerEstadoPedido(true)}
                className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-1.5"
              >
                <Bell className="size-4" />
                Mi pedido
                <span className="size-2 rounded-full bg-yellow-500 animate-pulse" />
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar platillos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-3 pl-10 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                categoria === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-2xl border-border/60">
            <Package className="size-16 mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">
              No hay productos disponibles en esta categoria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-32">
            {filtered.map((p) => {
              const agotado = !p.disponible || (p.stock_calculado ?? 99) <= 0;
              const pocoStock =
                p.disponible &&
                p.stock_calculado > 0 &&
                p.stock_calculado <= 5;
              return (
                <div
                  key={p.id}
                  className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="aspect-4/3 bg-muted flex items-center justify-center relative">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="size-12 text-muted-foreground/30" />
                    )}
                    {agotado && (
                      <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
                        <span className="bg-destructive text-white px-3 py-1 rounded-full text-xs font-bold">
                          Agotado
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm line-clamp-2">{p.nombre}</p>
                    {p.descripcion && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {p.descripcion}
                      </p>
                    )}
                    {pocoStock && (
                      <p className="text-[10px] text-orange-600 font-medium mt-1">
                        Solo quedan {p.stock_calculado} disponibles
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-primary tabular-nums">
                        ${p.precio?.toFixed(2) || "0.00"}
                      </span>
                      <button
                        onClick={() => addToCart(p)}
                        disabled={!mesaId || agotado}
                        className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Agregar al carrito"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {cart.length > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 bg-card border border-border rounded-xl shadow-2xl z-40">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <ShoppingCart className="size-4" />
                  {cart.reduce((s, i) => s + i.cantidad, 0)} articulos
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  ${totalCart.toFixed(2)} (inc. IVA)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCart([])}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Vaciar
                </button>
                <button
                  onClick={enviarPedido}
                  disabled={enviando || !mesaId}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {enviando ? "Enviando..." : "Pedir y pagar"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
              {cart.map((i) => (
                <span
                  key={i.id}
                  className="bg-muted px-2 py-1 rounded-full text-xs flex items-center gap-1"
                >
                  {i.nombre} x{i.cantidad}
                  <button
                    onClick={() => updateCantidad(i.id, -1)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Quitar uno"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <ClientPageContent />
    </Suspense>
  );
}
