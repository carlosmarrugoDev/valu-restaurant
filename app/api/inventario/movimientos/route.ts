// app/api/inventario/movimientos/route.ts
import { NextResponse, NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireTenantAuth } from "@/lib/auth";
import {
  registrarMovimiento,
  verificarDisponibilidadProducto,
} from "@/lib/inventario";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const insumoId = searchParams.get("insumo_id");
    const limite = parseInt(searchParams.get("limite") || "50");

    let query = supabase
      .from("movimientos_inventario")
      .select(
        `
        *,
        insumos (nombre, unidad),
        usuarios (nombre)
      `,
      )
      .eq("tenant_id", user.tenantId)
      .order("fecha_creacion", { ascending: false })
      .limit(limite);

    if (insumoId) {
      query = query.eq("insumo_id", insumoId);
    }

    const { data, error: queryError } = await query;
    if (queryError) throw queryError;

    return NextResponse.json({ success: true, movimientos: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req);
    if (error) return error;

    const body = await req.json();
    const { insumo_id, tipo, cantidad, motivo, referencia_id, costo_unitario } =
      body;

    if (!insumo_id || !tipo || cantidad === undefined) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const resultado = await registrarMovimiento(user.tenantId!, user.userId, {
      insumo_id,
      tipo,
      cantidad,
      motivo,
      referencia_id,
      costo_unitario,
    });

    if (!resultado.success) {
      return NextResponse.json({ error: resultado.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      movimiento: resultado,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
