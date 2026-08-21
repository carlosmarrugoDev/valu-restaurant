'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClientMode } from '@/components/pos/client-mode'
import { Loader2 } from 'lucide-react'

function ClientPageContent() {
  const searchParams = useSearchParams()
  const mesa = searchParams.get('mesa')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Si hay mesa en la URL, guardarla en sessionStorage
    if (mesa) {
      sessionStorage.setItem('mesa_cliente', mesa)
    }
    setLoading(false)
  }, [mesa])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <ClientMode />
      </div>
    </div>
  )
}

export default function ClientPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    }>
      <ClientPageContent />
    </Suspense>
  )
}