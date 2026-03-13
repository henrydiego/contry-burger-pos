export interface Producto {
  id: number
  nombre: string
  categoria: string
  precio_venta: number
  costo_unitario: number
  imagen_url?: string
  activo: boolean
  created_at?: string
}

export interface Inventario {
  id: number
  producto_id: number
  cantidad: number
  unidad: string
  stock_minimo: number
  ultima_actualizacion?: string
  producto?: Producto
}

export interface Receta {
  id: number
  producto_id: number
  ingrediente: string
  cantidad: number
  unidad: string
  costo: number
  producto?: Producto
}

export interface Compra {
  id: number
  proveedor: string
  producto: string
  cantidad: number
  unidad: string
  precio_unitario: number
  total: number
  fecha: string
  created_at?: string
}

export interface VentaItem {
  producto_id: number
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export interface Venta {
  id: number
  items: VentaItem[]
  total: number
  metodo_pago: string
  fecha: string
  created_at?: string
}

export interface Merma {
  id: number
  producto_id: number
  cantidad: number
  unidad: string
  motivo: string
  fecha: string
  costo_perdida: number
  producto?: Producto
}
