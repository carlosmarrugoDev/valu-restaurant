'use client'

import { AuthProvider } from '@/components/auth/auth-context'
import { AppShell } from '@/components/pos/app-shell'
import { AuthPage } from '@/components/auth/auth-page'
import { useAuth } from '@/components/auth/auth-context'

function MainContent() {
  const { user, loading, initialized } = useAuth()

  if (loading || !initialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return user ? <AppShell /> : <AuthPage />
}

export default function Page() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  )
}