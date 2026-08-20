// lib/auth.ts
import { supabase } from './supabase'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key'
export const TOKEN_COOKIE_NAME = 'auth_token'

export type PlanType = 'arranque' | 'profesional' | 'multi-sede'
export type RolType = 'dueno' | 'gerente' | 'mesero' | 'cocina' | 'cajero' | 'contador' | 'comprador' | 'vendedor' | 'admin'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: Record<string, any>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export interface AuthUser {
  userId: string
  tenantId: string | null
  sucursalId: string | null
  email: string
  nombre: string
  rol: string
  plan: string | null
}

export function getAuthUser(req: Request): AuthUser | null {
  const cookieHeader = req.headers.get('cookie') || ''
  const cookies = cookieHeader.split(';').map((c: string) => c.trim())
  let token: string | null = null
  
  for (const cookie of cookies) {
    if (cookie.startsWith(`${TOKEN_COOKIE_NAME}=`)) {
      token = decodeURIComponent(cookie.slice(`${TOKEN_COOKIE_NAME}=`.length))
      break
    }
  }
  
  if (!token) return null
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    return {
      userId: decoded.sub || decoded.userId,
      tenantId: decoded.tenantId || null,
      sucursalId: decoded.sucursalId || null,
      email: decoded.email || '',
      nombre: decoded.nombre || '',
      rol: decoded.rol || '',
      plan: decoded.plan || null,
    }
  } catch {
    return null
  }
}

export function requireTenantAuth(req: Request): 
  | { user: AuthUser; error: null }
  | { user: null; error: NextResponse } {
  const user = getAuthUser(req)
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
  }
  if (!user.tenantId) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Usuario sin tenant' }, { status: 403 })
    }
  }
  return { user, error: null }
}

export function checkPlanAccess(plan: string | null | undefined, module: string): boolean {
  if (!plan) return true
  const limits: Record<string, Record<string, boolean>> = {
    'arranque': { inventario: false, cocina: false, reportes: false },
    'profesional': { inventario: true, cocina: true, reportes: true },
    'multi-sede': { inventario: true, cocina: true, reportes: true },
  }
  return limits[plan]?.[module] !== false
}

export const PLAN_LIMITS: Record<string, { maxMesas: number; maxUsuarios: number; maxProductos: number }> = {
  'arranque': { maxMesas: 10, maxUsuarios: 3, maxProductos: 50 },
  'profesional': { maxMesas: 50, maxUsuarios: 15, maxProductos: Infinity },
  'multi-sede': { maxMesas: Infinity, maxUsuarios: Infinity, maxProductos: Infinity },
}