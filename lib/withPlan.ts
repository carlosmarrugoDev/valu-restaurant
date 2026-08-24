// lib/withPlan.ts
import { NextResponse } from 'next/server'
import { requireTenantAuth } from './auth'
import { verificarPlan, Plan } from './planes'

export function withPlan(funcionalidad: string) {
  return async function (req: Request, handler: Function) {
    const auth = requireTenantAuth(req)
    if (auth.error) return auth.error

    const plan = auth.user.plan as Plan | null
    if (!verificarPlan(plan, funcionalidad as any)) {
      return NextResponse.json(
        { error: `Tu plan no incluye ${funcionalidad}. Actualiza para acceder.` },
        { status: 403 }
      )
    }

    return handler(req, auth.user)
  }
}

// Uso en endpoints:
// export async function GET(req: Request) {
//   return withPlan('tieneInventario')(req, async (req, user) => {
//     // ... lógica del endpoint
//   })
// }