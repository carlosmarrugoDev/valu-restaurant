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
      .single();

    if (recetaError || !receta?.receta_items) {
      // Si no tiene receta, asumir que está disponible (producto sin insumos)
      return { disponible: true };
    }

    for (const item of receta.receta_items) {
      const insumo = item.insumos as any;
      const stockNecesario = item.cantidad * cantidad;

      if ((insumo.stock || 0) < stockNecesario) {
        return {
          disponible: false,
          faltante: insumo.nombre,
          stock_disponible: Math.floor((insumo.stock || 0) / item.cantidad),
        };
      }
    }

    return { disponible: true };
  } catch (error) {
    return { disponible: true }; // Si hay error, permitir (fallback seguro)
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
      const cantidad = ri.cantidad * item.cantidad;
      const resultado = await registrarMovimiento(tenantId, usuarioId, {
        insumo_id: ri.insumo_id,
        tipo: "venta",
        cantidad: -cantidad,
        motivo: `Pedido ${pedidoId}`,
        referencia_id: pedidoId,
      });

      if (!resultado.success) {
        return { success: false, error: resultado.error, movimientos };
      }

      movimientos.push({
        insumo_id: ri.insumo_id,
        cantidad: -cantidad,
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
        receta_items (insumo_id, cantidad)
      `,
      )
      .eq("producto_id", item.producto_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!receta?.receta_items) continue;

    for (const ri of receta.receta_items) {
      const cantidad = ri.cantidad * item.cantidad;
      const resultado = await registrarMovimiento(tenantId, usuarioId, {
        insumo_id: ri.insumo_id,
        tipo: "devolucion",
        cantidad: cantidad,
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
