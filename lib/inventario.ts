// lib/inventario.ts
import { supabase } from "./supabase";

export interface MovimientoInventario {
  insumo_id: string;
  tipo: "compra" | "venta" | "merma" | "ajuste" | "devolucion";
  cantidad: number;
  motivo?: string;
  referencia_id?: string;
  costo_unitario?: number;
}

export interface InsumoConStock {
  id: string;
  nombre: string;
  unidad: string;
  stock: number;
  stock_minimo: number;
  stock_critico: number;
}

const FACTORES_CONVERSION: Record<string, number> = {
  'kg': 1000,
  'g': 1,
  'l': 1000,
  'ml': 1,
  'libra': 500, // Común en Colombia (500g)
  'lb': 500,
  'unidad': 1,
  'unidades': 1,
  'pieza': 1,
  'piezas': 1,
};

function normalizarCantidad(cantidad: number, unidad: string): number {
  const unidadLower = (unidad || 'unidad').toLowerCase().trim();
  const factor = FACTORES_CONVERSION[unidadLower] || 1;
  return cantidad * factor;
}

function getFactorToBase(unidad: string): number {
  const u = (unidad || 'unidad').toLowerCase().trim();
  if (u === 'kg' || u === 'l') return 1000;
  if (u === 'libra' || u === 'lb') return 500;
  return 1;
}

/**
 * Registrar un movimiento de inventario
 * Siempre debe usarse esta función para cualquier cambio de stock
 */
export async function registrarMovimiento(
  tenantId: string,
  usuarioId: string,
  movimiento: MovimientoInventario,
): Promise<{ success: boolean; error?: string; nuevoStock?: number }> {
  try {
    // Obtener stock actual
    const { data: insumo, error: insumoError } = await supabase
      .from("insumos")
      .select("stock")
      .eq("id", movimiento.insumo_id)
      .eq("tenant_id", tenantId)
      .single();

    if (insumoError) throw insumoError;

    const stockAnterior = insumo.stock || 0;
    const stockNuevo = stockAnterior + movimiento.cantidad;

    if (stockNuevo < 0) {
      return { success: false, error: "Stock insuficiente" };
    }

    // Insertar movimiento
    const { error: movError } = await supabase
      .from("movimientos_inventario")
      .insert({
        tenant_id: tenantId,
        insumo_id: movimiento.insumo_id,
        tipo: movimiento.tipo,
        cantidad: movimiento.cantidad,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        costo_unitario: movimiento.costo_unitario || null,
        motivo: movimiento.motivo || null,
        referencia_id: movimiento.referencia_id || null,
        usuario_id: usuarioId,
      });

    if (movError) throw movError;

    // Actualizar stock
    const { error: updateError } = await supabase
      .from("insumos")
      .update({
        stock: stockNuevo,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq("id", movimiento.insumo_id)
      .eq("tenant_id", tenantId);

    if (updateError) throw updateError;

    return { success: true, nuevoStock: stockNuevo };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Verificar si un producto está disponible (tiene insumos suficientes)
 */
export async function verificarDisponibilidadProducto(
  tenantId: string,
  productoId: string,
  cantidad: number = 1,
): Promise<{
  disponible: boolean;
  faltante?: string;
  stock_disponible?: number;
}> {
  try {
    // Obtener receta del producto
    const { data: receta, error: recetaError } = await supabase
      .from("recetas")
      .select(
        `
        id,
        receta_items (
          insumo_id,
          cantidad,
          insumos (nombre, stock, unidad)
        )
      `,
      )
      .eq("producto_id", productoId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (recetaError || !receta?.receta_items) {
      // Si no tiene receta, asumir que está disponible (producto sin insumos)
      return { disponible: true };
    }

    let minUnits = Infinity;

    for (const item of receta.receta_items) {
      const insumo = item.insumos as any;
      const factor = getFactorToBase(insumo.unidad);
      const stockEnBase = (insumo.stock || 0) * factor;
      
      // Asumimos que la cantidad en la receta (item.cantidad) está en la unidad base (g, ml)
      // si el insumo está en kg o l.
      const stockNecesarioBase = item.cantidad * cantidad;
      
      const unitsPossible = Math.floor(stockEnBase / item.cantidad);
      if (unitsPossible < minUnits) minUnits = unitsPossible;

      if (stockEnBase < stockNecesarioBase) {
        return {
          disponible: false,
          faltante: insumo.nombre,
          stock_disponible: unitsPossible,
        };
      }
    }

    return { 
      disponible: minUnits >= cantidad,
      stock_disponible: minUnits === Infinity ? 999 : minUnits 
    };
  } catch (error) {
    return { disponible: true }; // Si hay error, permitir (fallback seguro)
  }
}

/**
 * Obtener disponibilidad de todos los productos para un tenant
 */
export async function obtenerDisponibilidadProductos(tenantId: string): Promise<Record<string, { disponible: boolean, stock_disponible: number }>> {
  try {
    const { data: recetas } = await supabase
      .from("recetas")
      .select(`
        producto_id,
        receta_items (
          insumo_id,
          cantidad,
          insumos (stock, unidad)
        )
      `)
      .eq("tenant_id", tenantId);

    const result: Record<string, { disponible: boolean, stock_disponible: number }> = {};

    if (!recetas) return result;

    for (const receta of recetas) {
      let minUnits = Infinity;
      let hasReceta = false;

      if (receta.receta_items && receta.receta_items.length > 0) {
        hasReceta = true;
        for (const item of receta.receta_items) {
          const insumo = item.insumos as any;
          if (!insumo) continue;
          
          const factor = getFactorToBase(insumo.unidad);
          const stockEnBase = (insumo.stock || 0) * factor;
          
          const unitsPossible = Math.floor(stockEnBase / item.cantidad);
          if (unitsPossible < minUnits) minUnits = unitsPossible;
        }
      }

      if (hasReceta) {
        result[receta.producto_id] = {
          disponible: minUnits > 0,
          stock_disponible: minUnits === Infinity ? 999 : minUnits
        };
      }
    }

    return result;
  } catch (error) {
    console.error("Error al obtener disponibilidad masiva:", error);
    return {};
  }
}

/**
 * Descontar insumos por pedido (al confirmar, no al cobrar)
 */
export async function descontarInsumosPorPedido(
  tenantId: string,
  usuarioId: string,
  pedidoId: string,
  items: { producto_id: string; cantidad: number }[],
): Promise<{ success: boolean; error?: string; movimientos: any[] }> {
  const movimientos = [];

  for (const item of items) {
    // Obtener receta del producto
    const { data: receta, error: recetaError } = await supabase
      .from("recetas")
      .select(
        `
        id,
        receta_items (
          insumo_id,
          cantidad,
          insumos (nombre)
        )
      `,
      )
      .eq("producto_id", item.producto_id)
      .eq("tenant_id", tenantId)
      .single();

    if (recetaError || !receta?.receta_items) continue;

    for (const ri of receta.receta_items) {
      const insumo = ri.insumos as any;
      const factor = getFactorToBase(insumo.unidad);
      
      // Cantidad a descontar convertida a la unidad del insumo
      // ri.cantidad está en base (g, ml) y el stock está en la unidad original (kg, l)
      const cantidadADescontar = (ri.cantidad * item.cantidad) / factor;

      const resultado = await registrarMovimiento(tenantId, usuarioId, {
        insumo_id: ri.insumo_id,
        tipo: "venta",
        cantidad: -cantidadADescontar,
        motivo: `Pedido ${pedidoId}`,
        referencia_id: pedidoId,
      });

      if (!resultado.success) {
        return { success: false, error: resultado.error, movimientos };
      }

      movimientos.push({
        insumo_id: ri.insumo_id,
        cantidad: -cantidadADescontar,
        nuevoStock: resultado.nuevoStock,
      });
    }
  }

  return { success: true, movimientos };
}

/**
 * Revertir descuento de insumos (al cancelar pedido)
 */
export async function revertirDescuentoInsumos(
  tenantId: string,
  usuarioId: string,
  pedidoId: string,
  items: { producto_id: string; cantidad: number }[],
): Promise<{ success: boolean; error?: string }> {
  for (const item of items) {
    const { data: receta } = await supabase
      .from("recetas")
      .select(
        `
        receta_items (
          insumo_id, 
          cantidad,
          insumos (unidad)
        )
      `,
      )
      .eq("producto_id", item.producto_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!receta?.receta_items) continue;

    for (const ri of receta.receta_items) {
      const insumo = ri.insumos as any;
      const factor = getFactorToBase(insumo?.unidad);
      const cantidadADevolver = (ri.cantidad * item.cantidad) / factor;

      const resultado = await registrarMovimiento(tenantId, usuarioId, {
        insumo_id: ri.insumo_id,
        tipo: "devolucion",
        cantidad: cantidadADevolver,
        motivo: `Cancelación pedido ${pedidoId}`,
        referencia_id: pedidoId,
      });

      if (!resultado.success) {
        return { success: false, error: resultado.error };
      }
    }
  }

  return { success: true };
}

/**
 * Obtener alertas de stock crítico
 */
export async function obtenerAlertasStock(tenantId: string): Promise<any[]> {
  const { data: insumos, error } = await supabase
    .from("insumos")
    .select("*")
    .eq("tenant_id", tenantId)
    .lt(
      "stock",
      supabase.rpc("least", { a: "stock_minimo", b: "stock_critico" }),
    );

  if (error) return [];

  return (insumos || []).map((insumo: any) => {
    const estado = insumo.stock <= insumo.stock_critico ? "critico" : "bajo";
    return {
      id: insumo.id,
      nombre: insumo.nombre,
      stock: insumo.stock,
      stock_minimo: insumo.stock_minimo,
      stock_critico: insumo.stock_critico,
      unidad: insumo.unidad || "unidades",
      estado,
      faltante: insumo.stock_minimo - insumo.stock,
    };
  });
}

export async function validarStockPedido(
  tenantId: string,
  items: { producto_id: string; cantidad: number }[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const faltantes: string[] = []
    for (const it of items) {
      const r = await verificarDisponibilidadProducto(tenantId, it.producto_id, it.cantidad || 1)
      if (!r.disponible) {
        faltantes.push(`${r.faltante || it.producto_id} (disp: ${r.stock_disponible ?? 0})`)
      }
    }
    if (faltantes.length > 0) {
      return { success: false, error: faltantes.join(', ') }
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || 'Error de validacion' }
  }
}

/**
 * Calcular costo de un platillo
 */
export async function calcularCostoPlatillo(
  tenantId: string,
  productoId: string,
): Promise<number> {
  const { data: receta } = await supabase
    .from("recetas")
    .select(
      `
      receta_items (
        cantidad,
        insumos (costo_unitario)
      )
    `,
    )
    .eq("producto_id", productoId)
    .eq("tenant_id", tenantId)
    .single();

  if (!receta?.receta_items) return 0;

  let costoTotal = 0;
  for (const item of receta.receta_items) {
    const insumo = item.insumos as any;
    costoTotal += item.cantidad * (insumo.costo_unitario || 0);
  }

  return costoTotal;
}
