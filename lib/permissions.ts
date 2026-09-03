// lib/permissions.ts
export type Rol =
  | "dueno"
  | "gerente"
  | "mesero"
  | "cocina"
  | "cajero"
  | "admin";

export type Permiso =
  | "ver_dashboard"
  | "ver_reportes"
  | "ver_inventario"
  | "ver_costos"
  | "ver_empleados"
  | "ver_configuracion"
  | "editar_productos"
  | "editar_precios"
  | "editar_empleados"
  | "tomar_pedidos"
  | "ver_cocina"
  | "preparar_pedidos"
  | "cobrar_pedidos"
  | "abrir_caja"
  | "cerrar_caja"
  | "ver_cierre_caja"
  | "anular_cobro"
  | "modificar_pedido"
  | "cancelar_pedido"
  | "aplicar_descuento"
  | "ver_reservas"
  | "gestionar_reservas"
  | "ver_clientes"
  | "gestionar_clientes";

export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  dueno: [
    "ver_dashboard",
    "ver_reportes",
    "ver_inventario",
    "ver_costos",
    "ver_empleados",
    "ver_configuracion",
    "editar_productos",
    "editar_precios",
    "editar_empleados",
    "tomar_pedidos",
    "ver_cocina",
    "preparar_pedidos",
    "cobrar_pedidos",
    "abrir_caja",
    "cerrar_caja",
    "ver_cierre_caja",
    "anular_cobro",
    "modificar_pedido",
    "cancelar_pedido",
    "aplicar_descuento",
    "ver_reservas",
    "gestionar_reservas",
    "ver_clientes",
    "gestionar_clientes",
  ],
  gerente: [
    "ver_dashboard",
    "ver_reportes",
    "ver_inventario",
    "ver_empleados",
    "tomar_pedidos",
    "ver_cocina",
    "preparar_pedidos",
    "cobrar_pedidos",
    "abrir_caja",
    "cerrar_caja",
    "ver_cierre_caja",
    "modificar_pedido",
    "cancelar_pedido",
    "aplicar_descuento",
    "ver_reservas",
    "gestionar_reservas",
    "ver_clientes",
    "gestionar_clientes",
  ],
  mesero: [
    "tomar_pedidos",
    "ver_cocina",
    "cobrar_pedidos",
    "modificar_pedido",
    "cancelar_pedido",
    "aplicar_descuento",
    "ver_reservas",
    "ver_clientes",
  ],
  cocina: ["ver_cocina", "preparar_pedidos"],
  cajero: [
    "cobrar_pedidos",
    "ver_cierre_caja",
    "anular_cobro",
    "ver_reportes",
    "abrir_caja",
    "cerrar_caja",
  ],
  admin: [
    "ver_dashboard",
    "ver_reportes",
    "ver_inventario",
    "ver_costos",
    "ver_empleados",
    "ver_configuracion",
    "editar_productos",
    "editar_precios",
    "editar_empleados",
    "tomar_pedidos",
    "ver_cocina",
    "preparar_pedidos",
    "cobrar_pedidos",
    "abrir_caja",
    "cerrar_caja",
    "ver_cierre_caja",
    "anular_cobro",
    "modificar_pedido",
    "cancelar_pedido",
    "aplicar_descuento",
  ],
};

export function tienePermiso(rol: Rol | string, permiso: Permiso): boolean {
  const permisos = PERMISOS_POR_ROL[rol as Rol];
  if (!permisos) return false;
  return permisos.includes(permiso);
}

export function filtrarPorPermiso<T extends { id: string }>(
  items: T[],
  rol: Rol | string,
  permiso: Permiso,
): T[] {
  if (!tienePermiso(rol, permiso)) return [];
  return items;
}
