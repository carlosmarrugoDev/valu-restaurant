// lib/db-init.ts
import { supabase } from './supabase'
import { hashPassword } from './auth'

export type PlanType = 'arranque' | 'profesional' | 'multi-sede'

let initialized = false

export async function initDatabase() {
  if (initialized) return true
  
  try {
    console.log('🔧 Verificando base de datos...')
    
    // Verificar si ya hay tenants
    const { data: tenants, error: checkError } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)
    
    if (tenants && tenants.length > 0) {
      console.log('✅ Base de datos ya inicializada')
      initialized = true
      return true
    }
    
    console.log('📦 Creando datos iniciales...')
    
    // 1. Crear tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        nombre: 'Restaurante Demo',
        plan: 'profesional',
        email_contacto: 'admin@demo.com',
        activo: true
      })
      .select()
      .single()
    
    if (tenantError) throw tenantError
    const tenantId = tenant.id
    
    // 2. Crear sucursal
    const { data: sucursal } = await supabase
      .from('sucursales')
      .insert({
        tenant_id: tenantId,
        nombre: 'Sucursal Principal',
        activa: true
      })
      .select()
      .single()
    
    // 3. Crear usuario admin
    const passwordHash = await hashPassword('demo123')
    await supabase
      .from('usuarios')
      .insert({
        tenant_id: tenantId,
        sucursal_id: sucursal?.id || null,
        email: 'admin@demo.com',
        password_hash: passwordHash,
        nombre: 'Administrador Demo',
        rol: 'dueno'
      })
    
    // 4. Crear categorías
    const categorias = [
      { nombre: 'Entradas', color: 'amber', orden: 1 },
      { nombre: 'Platos fuertes', color: 'red', orden: 2 },
      { nombre: 'Bebidas', color: 'blue', orden: 3 },
      { nombre: 'Postres', color: 'pink', orden: 4 },
    ]
    
    for (const cat of categorias) {
      await supabase
        .from('categorias')
        .insert({
          tenant_id: tenantId,
          nombre: cat.nombre,
          color: cat.color,
          orden: cat.orden,
          activa: true
        })
    }
    
    // 5. Obtener IDs de categorías
    const { data: cats } = await supabase
      .from('categorias')
      .select('id, nombre')
      .eq('tenant_id', tenantId)
    
    const catMap: Record<string, string> = {}
    cats?.forEach((c: any) => { catMap[c.nombre] = c.id })
    
    // 6. Crear productos
    const productos = [
      { nombre: 'Guacamole tradicional', precio: 120, categoria: 'Entradas' },
      { nombre: 'Aguachile verde', precio: 185, categoria: 'Entradas' },
      { nombre: 'Queso fundido', precio: 145, categoria: 'Entradas' },
      { nombre: 'Tacos al pastor', precio: 165, categoria: 'Platos fuertes' },
      { nombre: 'Ribeye 400g', precio: 480, categoria: 'Platos fuertes' },
      { nombre: 'Enchiladas de mole', precio: 210, categoria: 'Platos fuertes' },
      { nombre: 'Agua de horchata', precio: 55, categoria: 'Bebidas' },
      { nombre: 'Margarita clásica', precio: 135, categoria: 'Bebidas' },
      { nombre: 'Cerveza artesanal', precio: 85, categoria: 'Bebidas' },
      { nombre: 'Flan de la casa', precio: 95, categoria: 'Postres' },
      { nombre: 'Churros con cajeta', precio: 90, categoria: 'Postres' },
      { nombre: 'Tres leches', precio: 110, categoria: 'Postres' },
    ]
    
    for (const prod of productos) {
      await supabase
        .from('productos')
        .insert({
          tenant_id: tenantId,
          categoria_id: catMap[prod.categoria] || null,
          nombre: prod.nombre,
          precio: prod.precio,
          costo: Math.round(prod.precio * 0.35),
          stock: 100,
          disponible: true
        })
    }
    
    // 7. Crear mesas
    const mesas = [
      { nombre: 'Mesa 1', asientos: 2, forma: 'circulo', zona: 'Salón principal' },
      { nombre: 'Mesa 2', asientos: 4, forma: 'cuadro', zona: 'Salón principal' },
      { nombre: 'Mesa 3', asientos: 4, forma: 'cuadro', zona: 'Salón principal' },
      { nombre: 'Mesa 4', asientos: 4, forma: 'cuadro', zona: 'Salón principal' },
      { nombre: 'Mesa 5', asientos: 2, forma: 'circulo', zona: 'Salón principal' },
      { nombre: 'Mesa 6', asientos: 4, forma: 'cuadro', zona: 'Salón principal' },
      { nombre: 'Barra 1', asientos: 1, forma: 'circulo', zona: 'Barra' },
      { nombre: 'Barra 2', asientos: 1, forma: 'circulo', zona: 'Barra' },
      { nombre: 'Terraza 1', asientos: 4, forma: 'cuadro', zona: 'Terraza' },
    ]
    
    for (let i = 0; i < mesas.length; i++) {
      await supabase
        .from('mesas')
        .insert({
          tenant_id: tenantId,
          sucursal_id: sucursal?.id || null,
          nombre: mesas[i].nombre,
          asientos: mesas[i].asientos,
          forma: mesas[i].forma,
          zona: mesas[i].zona,
          estado: 'libre',
          orden: i + 1
        })
    }
    
    console.log('✅ Base de datos inicializada con datos demo')
    console.log('👤 Usuario: admin@demo.com / demo123')
    
    initialized = true
    return true
  } catch (error: any) {
    console.error('❌ Error inicializando:', error)
    throw error
  }
}

export async function seedTenantData(tenantId: string, sucursalId: string | null) {
  try {
    // 1. Crear categorías
    const categorias = [
      { nombre: 'Entradas', color: 'amber', orden: 1 },
      { nombre: 'Platos fuertes', color: 'red', orden: 2 },
      { nombre: 'Bebidas', color: 'blue', orden: 3 },
      { nombre: 'Postres', color: 'pink', orden: 4 },
    ]
    
    for (const cat of categorias) {
      await supabase
        .from('categorias')
        .insert({
          tenant_id: tenantId,
          nombre: cat.nombre,
          color: cat.color,
          orden: cat.orden,
          activa: true
        })
    }
    
    // 2. Obtener IDs de categorías recién creadas
    const { data: cats } = await supabase
      .from('categorias')
      .select('id, nombre')
      .eq('tenant_id', tenantId)
    
    const catMap: Record<string, string> = {}
    cats?.forEach((c: any) => { catMap[c.nombre] = c.id })
    
    // 3. Crear productos
    const productos = [
      { nombre: 'Guacamole tradicional', precio: 120, categoria: 'Entradas' },
      { nombre: 'Aguachile verde', precio: 185, categoria: 'Entradas' },
      { nombre: 'Queso fundido', precio: 145, categoria: 'Entradas' },
      { nombre: 'Tacos al pastor', precio: 165, categoria: 'Platos fuertes' },
      { nombre: 'Ribeye 400g', precio: 480, categoria: 'Platos fuertes' },
      { nombre: 'Enchiladas de mole', precio: 210, categoria: 'Platos fuertes' },
      { nombre: 'Agua de horchata', precio: 55, categoria: 'Bebidas' },
      { nombre: 'Margarita clásica', precio: 135, categoria: 'Bebidas' },
      { nombre: 'Cerveza artesanal', precio: 85, categoria: 'Bebidas' },
      { nombre: 'Flan de la casa', precio: 95, categoria: 'Postres' },
      { nombre: 'Churros con cajeta', precio: 90, categoria: 'Postres' },
      { nombre: 'Tres leches', precio: 110, categoria: 'Postres' },
    ]
    
    for (const prod of productos) {
      await supabase
        .from('productos')
        .insert({
          tenant_id: tenantId,
          categoria_id: catMap[prod.categoria] || null,
          nombre: prod.nombre,
          precio: prod.precio,
          costo: Math.round(prod.precio * 0.35),
          stock: 100,
          disponible: true
        })
    }
    
    // 4. Crear mesas
    const mesas = [
      { nombre: 'Mesa 1', asientos: 2, forma: 'circulo', zona: 'Salón principal' },
      { nombre: 'Mesa 2', asientos: 4, forma: 'cuadro', zona: 'Salón principal' },
      { nombre: 'Mesa 3', asientos: 4, forma: 'cuadro', zona: 'Salón principal' },
      { nombre: 'Mesa 4', asientos: 4, forma: 'cuadro', zona: 'Salón principal' },
      { nombre: 'Mesa 5', asientos: 2, forma: 'circulo', zona: 'Salón principal' },
      { nombre: 'Mesa 6', asientos: 4, forma: 'cuadro', zona: 'Salón principal' },
      { nombre: 'Barra 1', asientos: 1, forma: 'circulo', zona: 'Barra' },
      { nombre: 'Barra 2', asientos: 1, forma: 'circulo', zona: 'Barra' },
      { nombre: 'Terraza 1', asientos: 4, forma: 'cuadro', zona: 'Terraza' },
    ]
    
    for (let i = 0; i < mesas.length; i++) {
      await supabase
        .from('mesas')
        .insert({
          tenant_id: tenantId,
          sucursal_id: sucursalId,
          nombre: mesas[i].nombre,
          asientos: mesas[i].asientos,
          forma: mesas[i].forma,
          zona: mesas[i].zona,
          estado: 'libre',
          orden: i + 1
        })
    }

    // 5. Crear insumos demo de inventario
    const insumos = [
      { nombre: 'Aguacate', unidad: 'kg', stock: 15, stock_minimo: 5, costo_unitario: 60 },
      { nombre: 'Carne Pastor', unidad: 'kg', stock: 25, stock_minimo: 8, costo_unitario: 120 },
      { nombre: 'Queso Oaxaca', unidad: 'kg', stock: 10, stock_minimo: 3, costo_unitario: 90 },
      { nombre: 'Tortillas', unidad: 'kg', stock: 40, stock_minimo: 10, costo_unitario: 22 },
      { nombre: 'Jarra de Canela/Arroz', unidad: 'L', stock: 30, stock_minimo: 5, costo_unitario: 15 },
    ]

    for (const ins of insumos) {
      await supabase
        .from('insumos')
        .insert({
          tenant_id: tenantId,
          nombre: ins.nombre,
          unidad: ins.unidad,
          stock: ins.stock,
          stock_minimo: ins.stock_minimo,
          costo_unitario: ins.costo_unitario
        })
    }

    console.log(`✅ Datos iniciales sembrados para tenant: ${tenantId}`)
  } catch (err) {
    console.error('Error sembrando datos del tenant:', err)
  }
}

export async function createTenant(nombre: string, plan: PlanType, telefono?: string, direccion?: string): Promise<string> {
  const { data, error } = await supabase
    .from('tenants')
    .insert({
      nombre,
      plan,
      telefono: telefono || null,
      direccion: direccion || null,
      activo: true
    })
    .select()
    .single()
  
  if (error) throw error
  
  const { data: sucursal } = await supabase
    .from('sucursales')
    .insert({
      tenant_id: data.id,
      nombre: `${nombre} - Principal`,
      telefono: telefono || null,
      direccion: direccion || null,
      activa: true
    })
    .select()
    .single()
  
  await seedTenantData(data.id, sucursal?.id || null)

  return data.id
}

export async function getMainSucursal(tenantId: string): Promise<string | null> {
  const { data } = await supabase
    .from('sucursales')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('fecha_creacion', { ascending: true })
    .limit(1)
    .single()
  
  return data?.id || null
}