export interface Producto {
  id: string
  nombre: string
  categoria: string
  costo: number
  precio_venta: number
  activo: boolean
  imagen_url?: string | null
  agotado?: boolean
}

export interface Inventario {
  ingrediente_id: string
  nombre: string
  categoria: string
  stock_actual: number
  stock_inicial: number
  stock_minimo: number
  unidad: string
  total_comprado: number
  consumo_total: number
  total_merma: number
  costo_promedio: number
}

export interface Receta {
  id: string
  producto_id: string
  ingrediente_id: string
  producto_nombre: string
  ingrediente_nombre: string
  cantidad: number
  unidad: string
}

export interface Compra {
  id: number
  compra_id: string
  ingrediente_id: string
  ingrediente: string
  proveedor: string
  cantidad: number
  unidad: string
  costo_unitario: number
  costo_total: number
  notas: string
  fecha: string
}

export interface Venta {
  id: number
  order_id: string
  producto_id: string
  producto: string
  categoria: string
  cantidad: number
  precio_unitario: number
  total: number
  metodo_pago: string
  cajero: string
  estado: string
  hora: string
  fecha: string
}

export interface Merma {
  id: number
  merma_id: string
  ingrediente_id: string
  ingrediente: string
  cantidad_perdida: number
  unidad: string
  motivo: string
  costo_unitario: number
  costo_merma: number
  responsable: string
  fecha: string
}

export interface Gasto {
  id: number
  fecha: string
  tipo: string
  descripcion: string
  monto: number
  mes: number
  anio: number
}

export interface CajaDiaria {
  id: number
  fecha: string
  turno: string
  caja_inicial: number
  ventas_efectivo: number
  ventas_qr: number
  ventas_tarjeta: number
  otros_ingresos: number
  total_ingresos: number
  gastos_dia: number
  caja_final: number
  diferencia: number
  estado: string
}

export interface Pedido {
  id: number
  order_id: string
  cliente_nombre: string
  cliente_telefono: string
  items: PedidoItem[]
  total: number
  estado: "pending" | "preparing" | "ready" | "completed"
  metodo_pago: string
  notas: string
  fecha: string
  hora: string
}

export interface PedidoItem {
  producto_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}
