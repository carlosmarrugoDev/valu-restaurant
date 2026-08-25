'use client'

import { LogOut, PanelLeft } from 'lucide-react'
import { type Role, ROLES } from '@/lib/data'
import { Button } from '@/components/ui/button'
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/components/auth/auth-context'

type TopbarProps = {
  title: string
  role: Role
  onRoleChange: (role: Role) => void
  onMenuClick: () => void
}

export function Topbar({ title, role, onRoleChange, onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth()

  const userName = user?.nombre || 'Usuario'
  const tenantName = (user as any)?.tenant_nombre || 'Restaurante'
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick} aria-label="Abrir menú">
          <PanelLeft />
        </Button>
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight md:text-xl">{title}</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {tenantName} · Sucursal Principal
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-xs text-muted-foreground">Rol:</span>
          <Select value={role} onValueChange={(v) => v && onRoleChange(v as Role)}>
            <SelectTrigger className="w-[132px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <Avatar className="size-9 border border-border">
            <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden leading-tight lg:block">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted-foreground">{tenantName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut className="size-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
    </header>
  )
}
