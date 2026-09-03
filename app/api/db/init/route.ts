// app/api/db/init/route.ts
import { NextResponse } from 'next/server'
import { initDatabase } from '@/lib/db-init'

export async function GET() {
  try {
    await initDatabase()
    return NextResponse.json({
      success: true,
      message: 'Base de datos inicializada correctamente'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}