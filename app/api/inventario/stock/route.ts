// app/api/inventario/stock/route.ts
import { NextResponse, NextRequest } from "next/server";
import { requireTenantAuth } from "@/lib/auth";
import { verificarDisponibilidadProducto } from "@/lib/inventario";

export async function POST(req: NextRequest) {
  try {
    const { user, error } = requireTenantAuth(req);
    if (error) return error;

    const body = await req.json();
    const { producto_id, cantidad } = body;

    if (!producto_id) {
      return NextResponse.json(
        { error: "Producto ID requerido" },
        { status: 400 },
      );
    }

    const resultado = await verificarDisponibilidadProducto(
      user.tenantId!,
      producto_id,
      cantidad || 1,
    );

    return NextResponse.json({
      success: true,
      disponible: resultado.disponible,
      faltante: resultado.faltante,
      stock_disponible: resultado.stock_disponible,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
