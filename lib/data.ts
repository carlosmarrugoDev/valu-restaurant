// Datos simulados (mock) para la demo del sistema de restaurante.

export type Role = 'dueno' | 'gerente' | 'mesero' | 'cocina' | 'cajero'

export const ROLES: { id: Role; label: string }[] = [
  { id: 'dueno', label: 'Dueño' },
  { id: 'gerente', label: 'Gerente' },
  { id: 'mesero', label: 'Mesero' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'cajero', label: 'Cajero' },
]

export type ModuleId =
  | 'dashboard'
  | 'mesas'
  | 'pedidos'
  | 'cocina'
  | 'cobro'
  | 'caja'
  | 'productos'
  | 'reportes'
  | 'inventario'
  | 'recetas'
  | 'personal'
  | 'asignar'
  | 'qr'
  | 'configuracion'

// Qué módulos puede ver cada rol.
export const ROLE_ACCESS: Record<Role, ModuleId[]> = {
  dueno: [
    'dashboard',
    'mesas',
    'pedidos',
    'cocina',
    'cobro',
    'caja',
    'productos',
    'reportes',
    'inventario',
    'recetas',
    'personal',
    'asignar',
    'qr',
    'configuracion',
  ],
  gerente: [
    'dashboard',
    'mesas',
    'pedidos',
    'cocina',
    'cobro',
    'caja',
    'productos',
    'reportes',
    'inventario',
    'recetas',
    'personal',
    'asignar',
    'qr',
  ],
  mesero: ['mesas', 'pedidos', 'cobro', 'qr'],
  cocina: ['cocina'],
  cajero: ['mesas', 'pedidos', 'cobro', 'caja', 'reportes', 'qr'],
}

export const currency = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(n)

export const currencyDetailed = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(n)

// ---------- Dashboard ----------

export const dashboardMetrics = {
  ventasDia: 28450,
  ventasDiaDelta: 12.4,
  ventasSemana: 184300,
  ventasSemanaDelta: 8.1,
  ticketPromedio: 385,
  ticketPromedioDelta: -3.2,
  mesasOcupadas: 8,
  mesasTotales: 14,
}

export const ventasPorHora = [
  { hora: '10h', ventas: 1200 },
  { hora: '11h', ventas: 1850 },
  { hora: '12h', ventas: 3400 },
  { hora: '13h', ventas: 5200 },
  { hora: '14h', ventas: 6100 },
  { hora: '15h', ventas: 3800 },
  { hora: '16h', ventas: 1900 },
  { hora: '17h', ventas: 1500 },
  { hora: '18h', ventas: 2400 },
  { hora: '19h', ventas: 4300 },
  { hora: '20h', ventas: 5600 },
  { hora: '21h', ventas: 4900 },
]

export const platillosTop = [
  { nombre: 'Tacos al pastor', vendidos: 142 },
  { nombre: 'Ribeye 400g', vendidos: 98 },
  { nombre: 'Aguachile verde', vendidos: 76 },
  { nombre: 'Enchiladas mole', vendidos: 64 },
  { nombre: 'Flan de la casa', vendidos: 51 },
]

export type Transaccion = {
  id: string
  mesa: string
  mesero: string
  total: number
  metodo: 'Efectivo' | 'Tarjeta' | 'Digital'
  hora: string
}

export const ultimasTransacciones: Transaccion[] = [
  { id: 'T-1043', mesa: 'Mesa 5', mesero: 'Lucía R.', total: 620, metodo: 'Tarjeta', hora: '20:52' },
  { id: 'T-1042', mesa: 'Barra 2', mesero: 'Diego M.', total: 245, metodo: 'Efectivo', hora: '20:41' },
  { id: 'T-1041', mesa: 'Mesa 9', mesero: 'Lucía R.', total: 1180, metodo: 'Tarjeta', hora: '20:33' },
  { id: 'T-1040', mesa: 'Mesa 2', mesero: 'Karla T.', total: 430, metodo: 'Digital', hora: '20:18' },
  { id: 'T-1039', mesa: 'Terraza 1', mesero: 'Diego M.', total: 890, metodo: 'Tarjeta', hora: '20:04' },
  { id: 'T-1038', mesa: 'Mesa 7', mesero: 'Karla T.', total: 315, metodo: 'Efectivo', hora: '19:47' },
]

export type Alerta = {
  id: string
  tipo: 'stock' | 'mesa'
  nivel: 'critico' | 'aviso'
  mensaje: string
}

export const alertas: Alerta[] = [
  { id: 'a1', tipo: 'stock', nivel: 'critico', mensaje: 'Aguacate por debajo del mínimo (2 kg)' },
  { id: 'a2', tipo: 'stock', nivel: 'aviso', mensaje: 'Tortilla de maíz próxima a agotarse' },
  { id: 'a3', tipo: 'mesa', nivel: 'aviso', mensaje: 'Mesa 11 sin atención hace 18 min' },
  { id: 'a4', tipo: 'mesa', nivel: 'critico', mensaje: 'Terraza 3 con cuenta pedida hace 12 min' },
]

// ---------- Mesas ----------

export type EstadoMesa = 'libre' | 'ocupada' | 'cuenta' | 'reservada'

export type Mesa = {
  id: number
  nombre: string
  asientos: number
  estado: EstadoMesa
  mesero?: string
  minutos?: number
  total?: number
  forma: 'circulo' | 'cuadro'
}

export const estadoMesaLabel: Record<EstadoMesa, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  cuenta: 'Cuenta pedida',
  reservada: 'Reservada',
}

export const mesas: Mesa[] = [
  { id: 1, nombre: 'Mesa 1', asientos: 2, estado: 'libre', forma: 'circulo' },
  { id: 2, nombre: 'Mesa 2', asientos: 4, estado: 'ocupada', mesero: 'Karla T.', minutos: 34, total: 430, forma: 'cuadro' },
  { id: 3, nombre: 'Mesa 3', asientos: 4, estado: 'libre', forma: 'cuadro' },
  { id: 4, nombre: 'Mesa 4', asientos: 6, estado: 'reservada', forma: 'cuadro' },
  { id: 5, nombre: 'Mesa 5', asientos: 2, estado: 'cuenta', mesero: 'Lucía R.', minutos: 58, total: 620, forma: 'circulo' },
  { id: 6, nombre: 'Mesa 6', asientos: 4, estado: 'ocupada', mesero: 'Diego M.', minutos: 12, total: 210, forma: 'cuadro' },
  { id: 7, nombre: 'Mesa 7', asientos: 2, estado: 'ocupada', mesero: 'Karla T.', minutos: 41, total: 315, forma: 'circulo' },
  { id: 8, nombre: 'Mesa 8', asientos: 8, estado: 'libre', forma: 'cuadro' },
  { id: 9, nombre: 'Mesa 9', asientos: 6, estado: 'ocupada', mesero: 'Lucía R.', minutos: 22, total: 1180, forma: 'cuadro' },
  { id: 10, nombre: 'Terraza 1', asientos: 4, estado: 'ocupada', mesero: 'Diego M.', minutos: 8, total: 340, forma: 'cuadro' },
  { id: 11, nombre: 'Terraza 2', asientos: 4, estado: 'ocupada', mesero: 'Karla T.', minutos: 18, total: 275, forma: 'cuadro' },
  { id: 12, nombre: 'Terraza 3', asientos: 2, estado: 'cuenta', mesero: 'Lucía R.', minutos: 46, total: 510, forma: 'circulo' },
  { id: 13, nombre: 'Barra 1', asientos: 1, estado: 'libre', forma: 'circulo' },
  { id: 14, nombre: 'Barra 2', asientos: 1, estado: 'reservada', forma: 'circulo' },
]

// ---------- Menú / Pedidos ----------

export type Categoria = 'entradas' | 'fuertes' | 'bebidas' | 'postres'

export const categorias: { id: Categoria; label: string }[] = [
  { id: 'entradas', label: 'Entradas' },
  { id: 'fuertes', label: 'Platos fuertes' },
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'postres', label: 'Postres' },
]

export type Producto = {
  id: string
  nombre: string
  precio: number
  categoria: Categoria
  imagen: string
  descripcion: string
}

export const productos: Producto[] = [
  { id: 'p1', nombre: 'Guacamole tradicional', precio: 120, categoria: 'entradas', imagen: '/images/guacamole.png', descripcion: 'Molcajete con totopos de maíz azul' },
  { id: 'p2', nombre: 'Aguachile verde', precio: 185, categoria: 'entradas', imagen: '/images/aguachile.png', descripcion: 'Camarón, limón, chile serrano y pepino' },
  { id: 'p3', nombre: 'Queso fundido', precio: 145, categoria: 'entradas', imagen: '/images/queso-fundido.png', descripcion: 'Con chorizo y tortillas de harina' },
  { id: 'p4', nombre: 'Tostadas de tinga', precio: 128, categoria: 'entradas', imagen: '/images/tostadas-tinga.png', descripcion: 'Tres tostadas crujientes con pollo deshebrado' },
  { id: 'p5', nombre: 'Ceviche de pescado', precio: 172, categoria: 'entradas', imagen: '/images/ceviche-pescado.png', descripcion: 'Pescado blanco, limón, jitomate y cilantro' },
  { id: 'p6', nombre: 'Esquites con tuétano', precio: 155, categoria: 'entradas', imagen: '/images/esquites-tuetano.png', descripcion: 'Maíz salteado con mayonesa, queso y tuétano' },
  { id: 'p7', nombre: 'Tacos al pastor', precio: 165, categoria: 'fuertes', imagen: '/images/tacos-pastor.png', descripcion: 'Orden de 4, piña, cebolla y cilantro' },
  { id: 'p8', nombre: 'Ribeye 400g', precio: 480, categoria: 'fuertes', imagen: '/images/ribeye.png', descripcion: 'Corte premium con guarnición' },
  { id: 'p9', nombre: 'Enchiladas de mole', precio: 210, categoria: 'fuertes', imagen: '/images/enchiladas.png', descripcion: 'Mole poblano de la casa, pollo' },
  { id: 'p10', nombre: 'Filete al ajo', precio: 295, categoria: 'fuertes', imagen: '/images/filete-ajo.png', descripcion: 'Filete de res sellado con mantequilla y ajo' },
  { id: 'p11', nombre: 'Pescado zarandeado', precio: 320, categoria: 'fuertes', imagen: '/images/pescado-zarandeado.png', descripcion: 'Pescado entero con salsa de chile y limón' },
  { id: 'p12', nombre: 'Camarones al coco', precio: 265, categoria: 'fuertes', imagen: '/images/camarones-coco.png', descripcion: 'Camarones empanizados con salsa tropical' },
  { id: 'p13', nombre: 'Agua de horchata', precio: 55, categoria: 'bebidas', imagen: '/images/horchata.png', descripcion: 'Jarra de arroz con canela' },
  { id: 'p14', nombre: 'Margarita clásica', precio: 135, categoria: 'bebidas', imagen: '/images/margarita.png', descripcion: 'Tequila, limón y sal de gusano' },
  { id: 'p15', nombre: 'Cerveza artesanal', precio: 85, categoria: 'bebidas', imagen: '/images/cerveza.png', descripcion: 'IPA local 355ml' },
  { id: 'p16', nombre: 'Limonada mineral', precio: 68, categoria: 'bebidas', imagen: '/images/limonada-mineral.png', descripcion: 'Lima, hierbabuena y agua mineral' },
  { id: 'p17', nombre: 'Mezcalita de jamaica', precio: 148, categoria: 'bebidas', imagen: '/images/mezcalita-jamaica.png', descripcion: 'Mezcal joven con jarabe de jamaica' },
  { id: 'p18', nombre: 'Té de la casa', precio: 48, categoria: 'bebidas', imagen: '/images/te-casa.png', descripcion: 'Infusión fría de cítricos y especias' },
  { id: 'p19', nombre: 'Flan de la casa', precio: 95, categoria: 'postres', imagen: '/images/flan.png', descripcion: 'Napolitano con caramelo' },
  { id: 'p20', nombre: 'Churros con cajeta', precio: 90, categoria: 'postres', imagen: '/images/churros.png', descripcion: 'Orden de 5 con cajeta quemada' },
  { id: 'p21', nombre: 'Pastel de elote', precio: 105, categoria: 'postres', imagen: '/images/pastel-elote.png', descripcion: 'Con helado de vainilla' },
  { id: 'p22', nombre: 'Nieve artesanal', precio: 75, categoria: 'postres', imagen: '/images/nieve-artesanal.png', descripcion: 'Sorbete de temporada con fruta natural' },
  { id: 'p23', nombre: 'Tres leches', precio: 110, categoria: 'postres', imagen: '/images/tres-leches.png', descripcion: 'Pastel húmedo con crema batida' },
  { id: 'p24', nombre: 'Pan de elote', precio: 88, categoria: 'postres', imagen: '/images/pan-elote.png', descripcion: 'Rebanada tibia con cajeta' },
]

export type PedidoCocinaItem = {
  nombre: string
  cantidad: number
  nota?: string
}

export type PedidoCocina = {
  id: string
  mesa: string
  mesero: string
  minutos: number
  items: PedidoCocinaItem[]
  estado: 'nuevo' | 'preparando' | 'listo'
}

export const pedidosCocina: PedidoCocina[] = [
  {
    id: 'C-208',
    mesa: 'Mesa 9',
    mesero: 'Lucía R.',
    minutos: 3,
    estado: 'nuevo',
    items: [
      { nombre: 'Ribeye 400g', cantidad: 2, nota: 'Uno término medio, otro tres cuartos' },
      { nombre: 'Guacamole tradicional', cantidad: 1 },
      { nombre: 'Margarita clásica', cantidad: 2 },
    ],
  },
  {
    id: 'C-207',
    mesa: 'Terraza 1',
    mesero: 'Diego M.',
    minutos: 8,
    estado: 'preparando',
    items: [
      { nombre: 'Tacos al pastor', cantidad: 3, nota: 'Sin cebolla en uno' },
      { nombre: 'Agua de horchata', cantidad: 2 },
    ],
  },
  {
    id: 'C-206',
    mesa: 'Mesa 6',
    mesero: 'Diego M.',
    minutos: 14,
    estado: 'preparando',
    items: [
      { nombre: 'Enchiladas de mole', cantidad: 2 },
      { nombre: 'Queso fundido', cantidad: 1, nota: 'Extra tortillas' },
    ],
  },
  {
    id: 'C-205',
    mesa: 'Mesa 2',
    mesero: 'Karla T.',
    minutos: 19,
    estado: 'preparando',
    items: [
      { nombre: 'Aguachile verde', cantidad: 1, nota: 'Poco picante' },
      { nombre: 'Cerveza artesanal', cantidad: 2 },
    ],
  },
]

// ---------- Cobro ----------

export type ItemCuenta = {
  id: string
  nombre: string
  cantidad: number
  precio: number
}

export const cuentaActual: ItemCuenta[] = [
  { id: 'c1', nombre: 'Ribeye 400g', cantidad: 2, precio: 480 },
  { id: 'c2', nombre: 'Guacamole tradicional', cantidad: 1, precio: 120 },
  { id: 'c3', nombre: 'Margarita clásica', cantidad: 2, precio: 135 },
  { id: 'c4', nombre: 'Agua de horchata', cantidad: 1, precio: 55 },
  { id: 'c5', nombre: 'Flan de la casa', cantidad: 2, precio: 95 },
]

// ---------- Reportes ----------

export type VentaReporte = {
  fecha: string
  turno: 'Comida' | 'Cena'
  transacciones: number
  ingresos: number
  metodo: 'Efectivo' | 'Tarjeta' | 'Digital' | 'Mixto'
}

export const ventasReporte: VentaReporte[] = [
  { fecha: '2026-08-01', turno: 'Comida', transacciones: 62, ingresos: 24800, metodo: 'Mixto' },
  { fecha: '2026-08-01', turno: 'Cena', transacciones: 88, ingresos: 41200, metodo: 'Tarjeta' },
  { fecha: '2026-08-02', turno: 'Comida', transacciones: 55, ingresos: 21900, metodo: 'Mixto' },
  { fecha: '2026-08-02', turno: 'Cena', transacciones: 94, ingresos: 46500, metodo: 'Tarjeta' },
  { fecha: '2026-08-03', turno: 'Comida', transacciones: 48, ingresos: 18400, metodo: 'Efectivo' },
  { fecha: '2026-08-03', turno: 'Cena', transacciones: 79, ingresos: 38700, metodo: 'Digital' },
  { fecha: '2026-08-04', turno: 'Comida', transacciones: 66, ingresos: 26100, metodo: 'Mixto' },
  { fecha: '2026-08-04', turno: 'Cena', transacciones: 91, ingresos: 44300, metodo: 'Tarjeta' },
]

export const ingresosVsGastos = [
  { mes: 'Ene', ingresos: 520000, gastos: 340000 },
  { mes: 'Feb', ingresos: 485000, gastos: 325000 },
  { mes: 'Mar', ingresos: 610000, gastos: 372000 },
  { mes: 'Abr', ingresos: 588000, gastos: 358000 },
  { mes: 'May', ingresos: 672000, gastos: 401000 },
  { mes: 'Jun', ingresos: 705000, gastos: 418000 },
]

export type Costeo = {
  platillo: string
  precioVenta: number
  costoInsumos: number
}

export const costeoPlatillos: Costeo[] = [
  { platillo: 'Tacos al pastor', precioVenta: 165, costoInsumos: 48 },
  { platillo: 'Ribeye 400g', precioVenta: 480, costoInsumos: 210 },
  { platillo: 'Aguachile verde', precioVenta: 185, costoInsumos: 82 },
  { platillo: 'Enchiladas de mole', precioVenta: 210, costoInsumos: 71 },
  { platillo: 'Guacamole tradicional', precioVenta: 120, costoInsumos: 39 },
  { platillo: 'Margarita clásica', precioVenta: 135, costoInsumos: 34 },
]

export type CierreTurno = {
  turno: string
  esperado: number
  contado: number
}

export const cierresCaja: CierreTurno[] = [
  { turno: 'Comida — Caja 1', esperado: 14200, contado: 14150 },
  { turno: 'Comida — Caja 2', esperado: 9800, contado: 9800 },
  { turno: 'Cena — Caja 1', esperado: 22400, contado: 22530 },
  { turno: 'Cena — Caja 2', esperado: 18900, contado: 18620 },
]

// ---------- Inventario ----------

export type Insumo = {
  id: string
  nombre: string
  stock: number
  unidad: string
  minimo: number
}

export const insumos: Insumo[] = [
  { id: 'i1', nombre: 'Aguacate', stock: 2, unidad: 'kg', minimo: 8 },
  { id: 'i2', nombre: 'Tortilla de maíz', stock: 6, unidad: 'kg', minimo: 5 },
  { id: 'i3', nombre: 'Carne ribeye', stock: 14, unidad: 'kg', minimo: 6 },
  { id: 'i4', nombre: 'Camarón', stock: 4, unidad: 'kg', minimo: 5 },
  { id: 'i5', nombre: 'Queso Oaxaca', stock: 9, unidad: 'kg', minimo: 4 },
  { id: 'i6', nombre: 'Tequila blanco', stock: 12, unidad: 'botella', minimo: 6 },
  { id: 'i7', nombre: 'Limón', stock: 18, unidad: 'kg', minimo: 10 },
  { id: 'i8', nombre: 'Chile serrano', stock: 3, unidad: 'kg', minimo: 4 },
  { id: 'i9', nombre: 'Arroz', stock: 22, unidad: 'kg', minimo: 8 },
  { id: 'i10', nombre: 'Cerveza artesanal', stock: 48, unidad: 'botella', minimo: 24 },
]

export const estadoInsumo = (i: Insumo): 'ok' | 'bajo' | 'critico' => {
  if (i.stock <= i.minimo * 0.5) return 'critico'
  if (i.stock <= i.minimo) return 'bajo'
  return 'ok'
}

export type Receta = {
  platillo: string
  insumos: { nombre: string; cantidad: string }[]
}

export const recetas: Receta[] = [
  {
    platillo: 'Tacos al pastor (orden)',
    insumos: [
      { nombre: 'Carne de cerdo', cantidad: '220 g' },
      { nombre: 'Tortilla de maíz', cantidad: '4 pza' },
      { nombre: 'Piña', cantidad: '40 g' },
      { nombre: 'Cebolla', cantidad: '20 g' },
    ],
  },
  {
    platillo: 'Aguachile verde',
    insumos: [
      { nombre: 'Camarón', cantidad: '180 g' },
      { nombre: 'Limón', cantidad: '60 ml' },
      { nombre: 'Chile serrano', cantidad: '15 g' },
      { nombre: 'Pepino', cantidad: '50 g' },
    ],
  },
  {
    platillo: 'Guacamole tradicional',
    insumos: [
      { nombre: 'Aguacate', cantidad: '200 g' },
      { nombre: 'Tomate', cantidad: '40 g' },
      { nombre: 'Cebolla', cantidad: '25 g' },
      { nombre: 'Cilantro', cantidad: '10 g' },
    ],
  },
]