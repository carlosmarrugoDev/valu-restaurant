// lib/planes.ts
export type Plan = "arranque" | "profesional" | "multi_sede";

export interface PlanLimites {
  maxMesas: number;
  maxUsuarios: number;
  maxProductos: number;
  maxSucursales: number;
  tieneInventario: boolean;
  tieneReportesAvanzados: boolean;
  tieneCostoPlatillos: boolean;
  tieneMultiSede: boolean;
}

export const PLAN_LIMITES: Record<Plan, PlanLimites> = {
  arranque: {
    maxMesas: 9,
    maxUsuarios: 3,
    maxProductos: 50,
    maxSucursales: 1,
    tieneInventario: false,
    tieneReportesAvanzados: false,
    tieneCostoPlatillos: false,
    tieneMultiSede: false,
  },
  profesional: {
    maxMesas: 50,
    maxUsuarios: 15,
    maxProductos: Infinity,
    maxSucursales: 1,
    tieneInventario: true,
    tieneReportesAvanzados: true,
    tieneCostoPlatillos: true,
    tieneMultiSede: false,
  },
  multi_sede: {
    maxMesas: Infinity,
    maxUsuarios: Infinity,
    maxProductos: Infinity,
    maxSucursales: Infinity,
    tieneInventario: true,
    tieneReportesAvanzados: true,
    tieneCostoPlatillos: true,
    tieneMultiSede: true,
  },
};

export function verificarPlan(
  plan: Plan | string | null,
  funcionalidad: keyof PlanLimites,
): boolean {
  if (!plan) return true;
  const limites = PLAN_LIMITES[plan as Plan];
  if (!limites) return true;
  return limites[funcionalidad] !== false;
}

export function verificarLimite(
  plan: Plan | string | null,
  funcionalidad: keyof Omit<
    PlanLimites,
    | "tieneInventario"
    | "tieneReportesAvanzados"
    | "tieneCostoPlatillos"
    | "tieneMultiSede"
  >,
  actual: number,
): boolean {
  if (!plan) return true;
  const limites = PLAN_LIMITES[plan as Plan];
  if (!limites) return true;
  const limite = limites[funcionalidad] as number;
  if (limite === Infinity) return true;
  return actual < limite;
}

export function planTieneFuncionalidad(
  plan: Plan | string | null,
  funcionalidad: keyof Omit<
    PlanLimites,
    "maxMesas" | "maxUsuarios" | "maxProductos" | "maxSucursales"
  >,
): boolean {
  if (!plan) return true;
  const limites = PLAN_LIMITES[plan as Plan];
  if (!limites) return true;
  return limites[funcionalidad] || false;
}
