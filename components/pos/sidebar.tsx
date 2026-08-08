'use client'

import { Flame, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ModuleId } from '@/lib/data'
import type { NavItem } from './app-shell'
import { Button } from '@/components/ui/button'

type SidebarProps = {
  items: NavItem[]
  active?: ModuleId
  onNavigate: (id: ModuleId) => void
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}

function SidebarContent({
  items,
  active,
  onNavigate,
  onClose,
}: {
  items: NavItem[]
  active?: ModuleId
  onNavigate: (id: ModuleId) => void
  onClose?: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Flame className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-base font-semibold tracking-tight">Valu</p>
            <p className="text-xs text-muted-foreground">Valu Restaurantg</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onClose} aria-label="Cerrar menú">
            <X />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = item.id === active
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-lg bg-sidebar-accent/60 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-sidebar-foreground">Turno de cena</p>
          <p className="mt-0.5">Abierto desde las 17:00 h</p>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ items, active, onNavigate, mobileOpen, onMobileOpenChange }: SidebarProps) {
  return (
    <>
      {/* Escritorio */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
        <SidebarContent items={items} active={active} onNavigate={onNavigate} />
      </aside>

      {/* Móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => onMobileOpenChange(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-sidebar-border shadow-xl">
            <SidebarContent
              items={items}
              active={active}
              onNavigate={onNavigate}
              onClose={() => onMobileOpenChange(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
