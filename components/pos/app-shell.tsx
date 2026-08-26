'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  LayoutDashboard,
  LayoutGrid,
  ClipboardList,
  ChefHat,
  Receipt,
  Package,
  ChartColumnBig,
  Boxes,
  Users,
  Settings,
  Wallet,
  QrCode,
  BookOpen,
  UserCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Employees } from './employees'
import { ClientMode } from './client-mode'
import { Recipes } from './recipes'
import { AssignWaiter } from './assign-waiter'
import { type ModuleId, type Role, ROLE_ACCESS } from '@/lib/data'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { Dashboard } from './dashboard'
import { TablesMap } from './tables-map'
import { OrderTaking } from './order-taking'
import { Kitchen } from './kitchen'
import { Checkout } from './checkout'
import { Reports } from './reports'
import { Inventory } from './inventory'
import { CashRegister } from './cash-register'
import { SimpleModule } from './simple-module'
import { ProductManager } from '@/components/products/product-manager'
import { QRManager } from './qr-manager'
import { useAuth } from '@/components/auth/auth-context'

export type NavItem = {
  id: ModuleId
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'mesas', label: 'Mesas', icon: LayoutGrid },
  { id: 'pedidos', label: 'Pedidos', icon: ClipboardList },
  { id: 'cocina', label: 'Cocina', icon: ChefHat },
  { id: 'cobro', label: 'Cobro', icon: Receipt },
  { id: 'caja', label: 'Caja', icon: Wallet },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'reportes', label: 'Reportes', icon: ChartColumnBig },
  { id: 'inventario', label: 'Inventario', icon: Boxes },
  { id: 'recetas', label: 'Recetas', icon: BookOpen },
  { id: 'personal', label: 'Personal', icon: Users },
  { id: 'asignar', label: 'Asignar Mesero', icon: UserCheck },
  { id: 'qr', label: 'Código QR', icon: QrCode },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
]

export function AppShell() {
  const { user, loading: authLoading, refreshUser } = useAuth()
  const [role, setRole] = useState<Role>('dueno')
  const [active, setActive] = useState<ModuleId>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (user?.rol) {
      const validRoles: Role[] = ['dueno', 'gerente', 'mesero', 'cocina', 'cajero']
      const r = validRoles.includes(user.rol as Role) ? (user.rol as Role) : 'dueno'
      setRole(r)
    }
  }, [user?.rol])

  const allowed = ROLE_ACCESS[role]
  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => allowed.includes(item.id)),
    [allowed],
  )

  const currentActive = allowed.includes(active) ? active : visibleItems[0]?.id

  const handleRoleChange = (next: Role) => {
    setRole(next)
    const nextAllowed = ROLE_ACCESS[next]
    if (!nextAllowed.includes(active)) {
      const firstItem = NAV_ITEMS.find((i) => nextAllowed.includes(i.id))
      if (firstItem) setActive(firstItem.id)
    }
  }

  const handleNavigate = (id: ModuleId) => {
    setActive(id)
    setMobileOpen(false)
  }

  const activeLabel = NAV_ITEMS.find((i) => i.id === currentActive)?.label ?? ''

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <Sidebar
        items={visibleItems}
        active={currentActive}
        onNavigate={handleNavigate}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={activeLabel}
          role={role}
          onRoleChange={handleRoleChange}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6 lg:p-8">
            {currentActive === 'dashboard' && <Dashboard />}
            {currentActive === 'mesas' && <TablesMap />}
            {currentActive === 'pedidos' && <OrderTaking />}
            {currentActive === 'cocina' && <Kitchen />}
            {currentActive === 'cobro' && <Checkout />}
            {currentActive === 'caja' && <CashRegister />}
            {currentActive === 'productos' && <ProductManager />}
            {currentActive === 'reportes' && <Reports />}
            {currentActive === 'inventario' && <Inventory />}
            {currentActive === 'recetas' && <Recipes />}
            {currentActive === 'personal' && <Employees />}
            {currentActive === 'asignar' && <AssignWaiter />}
            {currentActive === 'qr' && <QRManager />}
            {currentActive === 'configuracion' && (
              <SimpleModule
                title="Configuración"
                description="Ajustes del restaurante: impuestos, impresoras, métodos de pago y preferencias. Módulo de demostración."
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}