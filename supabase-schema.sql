-- =============================================
-- CONTRY BURGER - SCHEMA UPDATE
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- 1. ACTUALIZAR tabla productos (agregar columnas faltantes)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_venta NUMERIC DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS costo NUMERIC DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Migrar datos existentes
UPDATE productos SET precio_venta = precio WHERE precio_venta = 0 OR precio_venta IS NULL;
UPDATE productos SET costo = costo_manual WHERE costo = 0 OR costo IS NULL;

-- 2. ACTUALIZAR tabla inventario (agregar columnas faltantes)
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT '';
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS stock_actual NUMERIC DEFAULT 0;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS total_comprado NUMERIC DEFAULT 0;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS consumo_total NUMERIC DEFAULT 0;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS total_merma NUMERIC DEFAULT 0;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS costo_promedio NUMERIC DEFAULT 0;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS ultima_actualizacion TIMESTAMPTZ DEFAULT now();

-- Migrar stock_inicial a stock_actual
UPDATE inventario SET stock_actual = stock_inicial WHERE stock_actual = 0 OR stock_actual IS NULL;

-- 3. ACTUALIZAR tabla recetas (agregar columnas faltantes)
ALTER TABLE recetas ADD COLUMN IF NOT EXISTS producto_nombre TEXT DEFAULT '';
ALTER TABLE recetas ADD COLUMN IF NOT EXISTS ingrediente_nombre TEXT DEFAULT '';
ALTER TABLE recetas ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT '';
ALTER TABLE recetas ADD COLUMN IF NOT EXISTS costo_ingrediente NUMERIC DEFAULT 0;

-- 4. ACTUALIZAR tabla compras
ALTER TABLE compras ADD COLUMN IF NOT EXISTS compra_id TEXT DEFAULT '';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS ingrediente_id TEXT DEFAULT '';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS ingrediente TEXT DEFAULT '';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS proveedor TEXT DEFAULT '';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS cantidad NUMERIC DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT '';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS costo_total NUMERIC DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT '';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS fecha DATE DEFAULT CURRENT_DATE;

-- 5. ACTUALIZAR tabla ventas
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS order_id TEXT DEFAULT '';
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS producto_id TEXT DEFAULT '';
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS producto TEXT DEFAULT '';
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT '';
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS metodo_pago TEXT DEFAULT 'Efectivo';
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cajero TEXT DEFAULT '';
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Pagado';
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS hora TIME DEFAULT CURRENT_TIME;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS fecha DATE DEFAULT CURRENT_DATE;

-- 6. CREAR tabla merma (si no existe)
CREATE TABLE IF NOT EXISTS merma (
  id SERIAL PRIMARY KEY,
  merma_id TEXT DEFAULT '',
  ingrediente_id TEXT DEFAULT '',
  ingrediente TEXT DEFAULT '',
  cantidad_perdida NUMERIC DEFAULT 0,
  unidad TEXT DEFAULT '',
  motivo TEXT DEFAULT '',
  costo_unitario NUMERIC DEFAULT 0,
  costo_merma NUMERIC DEFAULT 0,
  responsable TEXT DEFAULT '',
  fecha DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS y crear política para merma
ALTER TABLE merma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON merma;
CREATE POLICY "Allow all" ON merma FOR ALL USING (true) WITH CHECK (true);

-- 6b. ACTUALIZAR tabla merma (agregar columnas faltantes si ya existía)
ALTER TABLE merma ADD COLUMN IF NOT EXISTS merma_id TEXT DEFAULT '';
ALTER TABLE merma ADD COLUMN IF NOT EXISTS ingrediente_id TEXT DEFAULT '';
ALTER TABLE merma ADD COLUMN IF NOT EXISTS ingrediente TEXT DEFAULT '';
ALTER TABLE merma ADD COLUMN IF NOT EXISTS cantidad_perdida NUMERIC DEFAULT 0;
ALTER TABLE merma ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT '';
ALTER TABLE merma ADD COLUMN IF NOT EXISTS motivo TEXT DEFAULT '';
ALTER TABLE merma ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC DEFAULT 0;
ALTER TABLE merma ADD COLUMN IF NOT EXISTS costo_merma NUMERIC DEFAULT 0;
ALTER TABLE merma ADD COLUMN IF NOT EXISTS responsable TEXT DEFAULT '';
ALTER TABLE merma ADD COLUMN IF NOT EXISTS fecha DATE DEFAULT CURRENT_DATE;

-- 7. CREAR tabla gastos
CREATE TABLE IF NOT EXISTS gastos (
  id SERIAL PRIMARY KEY,
  fecha DATE DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT '',
  descripcion TEXT DEFAULT '',
  monto NUMERIC DEFAULT 0,
  mes INTEGER,
  anio INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. CREAR tabla caja_diaria
CREATE TABLE IF NOT EXISTS caja_diaria (
  id SERIAL PRIMARY KEY,
  fecha DATE DEFAULT CURRENT_DATE,
  turno TEXT DEFAULT 'Completo',
  caja_inicial NUMERIC DEFAULT 0,
  ventas_efectivo NUMERIC DEFAULT 0,
  ventas_qr NUMERIC DEFAULT 0,
  ventas_tarjeta NUMERIC DEFAULT 0,
  otros_ingresos NUMERIC DEFAULT 0,
  total_ingresos NUMERIC DEFAULT 0,
  gastos_dia NUMERIC DEFAULT 0,
  caja_final NUMERIC DEFAULT 0,
  diferencia NUMERIC DEFAULT 0,
  estado TEXT DEFAULT 'Cuadra',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. CREAR tabla pedidos (para sistema de pedidos online)
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  order_id TEXT UNIQUE,
  cliente_nombre TEXT DEFAULT '',
  cliente_telefono TEXT DEFAULT '',
  items JSONB DEFAULT '[]',
  total NUMERIC DEFAULT 0,
  estado TEXT DEFAULT 'pendiente',
  metodo_pago TEXT DEFAULT 'Efectivo',
  notas TEXT DEFAULT '',
  fecha DATE DEFAULT CURRENT_DATE,
  hora TIME DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Disable RLS for all tables (for development)
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE merma ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja_diaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust for production)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['productos','inventario','recetas','compras','ventas','merma','gastos','caja_diaria','pedidos']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all" ON %I', t);
    EXECUTE format('CREATE POLICY "Allow all" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- =============================================
-- SEED DATA: Productos del Excel
-- =============================================
-- Limpiar productos existentes e insertar los del Excel
DELETE FROM productos;
INSERT INTO productos (id, nombre, categoria, costo, precio_venta, activo) VALUES
  ('P001', 'Hamburguesa Clasica', 'Hamburguesas', 3.50, 7.99, true),
  ('P002', 'Hamburguesa Doble', 'Hamburguesas', 5.00, 10.99, true),
  ('P003', 'Hamburguesa BBQ', 'Hamburguesas', 4.50, 9.99, true),
  ('P004', 'Hot Dog', 'Hot Dogs', 2.00, 4.99, true),
  ('P005', 'Hot Dog Especial', 'Hot Dogs', 2.80, 5.99, true),
  ('P006', 'Papas Fritas Pequenas', 'Acompanantes', 0.80, 2.49, true),
  ('P007', 'Papas Fritas Grandes', 'Acompanantes', 1.20, 3.49, true),
  ('P008', 'Aros de Cebolla', 'Acompanantes', 1.00, 3.29, true),
  ('P009', 'Refresco', 'Bebidas', 0.50, 1.99, true),
  ('P010', 'Jugo Natural', 'Bebidas', 0.80, 2.49, true),
  ('P011', 'Agua', 'Bebidas', 0.30, 0.99, true),
  ('P012', 'Combo 1 (Hamb+Papas+Ref.)', 'Combos', 4.80, 10.99, true),
  ('P013', 'Combo 2 (Doble+Papas+Ref.)', 'Combos', 6.70, 13.99, true),
  ('P014', 'Nuggets x6', 'Otros', 1.50, 3.99, true),
  ('P015', 'Nuggets x12', 'Otros', 2.80, 6.99, true);

-- SEED: Inventario (ingredientes)
DELETE FROM inventario;
INSERT INTO inventario (ingrediente_id, nombre, categoria, stock_actual, stock_inicial, stock_minimo, unidad, costo_promedio) VALUES
  ('ING001', 'Carne de res (hamburguesa)', 'Carnes', 45, 45, 10, 'kg', 8),
  ('ING002', 'Pan de hamburguesa', 'Panaderia', 120, 120, 30, 'unidades', 0.3),
  ('ING003', 'Pan de hot dog', 'Panaderia', 60, 60, 20, 'unidades', 0.25),
  ('ING004', 'Salchichas', 'Carnes', 80, 80, 25, 'unidades', 0.4),
  ('ING005', 'Lechuga', 'Vegetales', 8, 8, 3, 'kg', 1.5),
  ('ING006', 'Tomate', 'Vegetales', 6, 6, 3, 'kg', 2),
  ('ING007', 'Cebolla', 'Vegetales', 10, 10, 3, 'kg', 1),
  ('ING008', 'Queso americano', 'Lacteos', 50, 50, 15, 'laminas', 0.2),
  ('ING009', 'Papas', 'Vegetales', 30, 30, 10, 'kg', 1.5),
  ('ING010', 'Aceite de cocina', 'Aceites', 12, 12, 3, 'litros', 3),
  ('ING011', 'Nuggets (precocidos)', 'Congelados', 200, 200, 50, 'unidades', 0.15),
  ('ING012', 'Refresco lata', 'Bebidas', 100, 100, 30, 'unidades', 0.5),
  ('ING013', 'Agua botella', 'Bebidas', 48, 48, 20, 'unidades', 0.3),
  ('ING014', 'Jugo natural (pulpa)', 'Bebidas', 5, 5, 2, 'litros', 3),
  ('ING015', 'Sal', 'Condimentos', 2, 2, 1, 'kg', 0.5),
  ('ING016', 'Salsas (ketchup/mayonesa)', 'Condimentos', 15, 15, 5, 'unidades', 1),
  ('ING017', 'Servilletas', 'Desechables', 500, 500, 100, 'unidades', 0.01),
  ('ING018', 'Vasos desechables', 'Desechables', 200, 200, 50, 'unidades', 0.05),
  ('ING019', 'Cajas de carton', 'Desechables', 80, 80, 30, 'unidades', 0.15),
  ('ING020', 'Guantes desechables', 'Higiene', 50, 50, 20, 'unidades', 0.1);

-- SEED: Recetas
DELETE FROM recetas;
INSERT INTO recetas (producto_id, ingrediente_id, producto_nombre, ingrediente_nombre, cantidad, unidad) VALUES
  ('P001', 'ING001', 'Hamburguesa Clasica', 'Carne de res', 0.15, 'kg'),
  ('P001', 'ING002', 'Hamburguesa Clasica', 'Pan de hamburguesa', 1, 'unidad'),
  ('P001', 'ING005', 'Hamburguesa Clasica', 'Lechuga', 0.03, 'kg'),
  ('P001', 'ING006', 'Hamburguesa Clasica', 'Tomate', 0.04, 'kg'),
  ('P001', 'ING008', 'Hamburguesa Clasica', 'Queso americano', 1, 'lamina'),
  ('P001', 'ING016', 'Hamburguesa Clasica', 'Salsas', 0.02, 'porcion'),
  ('P002', 'ING001', 'Hamburguesa Doble', 'Carne de res', 0.30, 'kg'),
  ('P002', 'ING002', 'Hamburguesa Doble', 'Pan de hamburguesa', 1, 'unidad'),
  ('P002', 'ING005', 'Hamburguesa Doble', 'Lechuga', 0.04, 'kg'),
  ('P002', 'ING006', 'Hamburguesa Doble', 'Tomate', 0.05, 'kg'),
  ('P002', 'ING008', 'Hamburguesa Doble', 'Queso americano', 2, 'lamina'),
  ('P002', 'ING016', 'Hamburguesa Doble', 'Salsas', 0.03, 'porcion'),
  ('P006', 'ING009', 'Papas Fritas Pequenas', 'Papas', 0.15, 'kg'),
  ('P006', 'ING010', 'Papas Fritas Pequenas', 'Aceite de cocina', 0.05, 'litros'),
  ('P006', 'ING015', 'Papas Fritas Pequenas', 'Sal', 0.005, 'kg'),
  ('P007', 'ING009', 'Papas Fritas Grandes', 'Papas', 0.25, 'kg'),
  ('P007', 'ING010', 'Papas Fritas Grandes', 'Aceite de cocina', 0.08, 'litros'),
  ('P007', 'ING015', 'Papas Fritas Grandes', 'Sal', 0.008, 'kg'),
  ('P004', 'ING004', 'Hot Dog', 'Salchichas', 1, 'unidad'),
  ('P004', 'ING003', 'Hot Dog', 'Pan de hot dog', 1, 'unidad'),
  ('P004', 'ING016', 'Hot Dog', 'Salsas', 0.02, 'porcion'),
  ('P008', 'ING007', 'Aros de Cebolla', 'Cebolla', 0.1, 'kg'),
  ('P008', 'ING010', 'Aros de Cebolla', 'Aceite de cocina', 0.04, 'litros'),
  ('P014', 'ING011', 'Nuggets x6', 'Nuggets (precocidos)', 6, 'unidad'),
  ('P014', 'ING010', 'Nuggets x6', 'Aceite de cocina', 0.03, 'litros'),
  ('P015', 'ING011', 'Nuggets x12', 'Nuggets (precocidos)', 12, 'unidad'),
  ('P015', 'ING010', 'Nuggets x12', 'Aceite de cocina', 0.05, 'litros'),
  ('P009', 'ING012', 'Refresco', 'Refresco lata', 1, 'unidad'),
  ('P010', 'ING014', 'Jugo Natural', 'Jugo natural (pulpa)', 0.25, 'litros'),
  ('P011', 'ING013', 'Agua', 'Agua botella', 1, 'unidad'),
  ('P012', 'ING001', 'Combo 1', 'Carne de res', 0.15, 'kg'),
  ('P012', 'ING002', 'Combo 1', 'Pan de hamburguesa', 1, 'unidad'),
  ('P012', 'ING009', 'Combo 1', 'Papas', 0.15, 'kg'),
  ('P012', 'ING010', 'Combo 1', 'Aceite de cocina', 0.05, 'litros'),
  ('P012', 'ING012', 'Combo 1', 'Refresco lata', 1, 'unidad'),
  ('P013', 'ING001', 'Combo 2', 'Carne de res', 0.30, 'kg'),
  ('P013', 'ING002', 'Combo 2', 'Pan de hamburguesa', 1, 'unidad'),
  ('P013', 'ING009', 'Combo 2', 'Papas', 0.20, 'kg'),
  ('P013', 'ING010', 'Combo 2', 'Aceite de cocina', 0.08, 'litros'),
  ('P013', 'ING012', 'Combo 2', 'Refresco lata', 1, 'unidad');

-- =============================================
-- TABLA: chat_mensajes (chat admin-cliente)
-- =============================================
CREATE TABLE IF NOT EXISTS chat_mensajes (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  remitente TEXT NOT NULL CHECK (remitente IN ('admin', 'cliente')),
  mensaje TEXT NOT NULL,
  leido BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_chat_pedido_id ON chat_mensajes(pedido_id);
CREATE INDEX IF NOT EXISTS idx_chat_order_id ON chat_mensajes(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_mensajes(created_at);

-- Enable RLS
ALTER TABLE chat_mensajes ENABLE ROW LEVEL SECURITY;

-- Politicas: todos pueden leer/escribir (ajustar para produccion si es necesario)
DROP POLICY IF EXISTS "Allow all chat" ON chat_mensajes;
CREATE POLICY "Allow all chat" ON chat_mensajes FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- HABILITAR REALTIME PARA CHAT
-- =============================================
-- Agregar tabla a la publicacion de realtime (para recibir cambios en tiempo real)
BEGIN;
  -- Verificar si la tabla ya esta en la publicacion
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND tablename = 'chat_mensajes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE chat_mensajes;
    END IF;
  END $$;
COMMIT;

-- Asegurar que replica identity este configurado (necesario para DELETE/UPDATE)
ALTER TABLE chat_mensajes REPLICA IDENTITY FULL;

-- =============================================
-- HABILITAR REALTIME PARA PEDIDOS
-- =============================================
-- Para actualizaciones de estado del pedido en tiempo real
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND tablename = 'pedidos'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
    END IF;
  END $$;
COMMIT;

-- Asegurar replica identity para pedidos
ALTER TABLE pedidos REPLICA IDENTITY FULL;

-- SEED: Gastos ejemplo
INSERT INTO gastos (fecha, tipo, descripcion, monto, mes, anio) VALUES
  ('2025-01-01', 'Alquiler', 'Renta del local enero', 800, 1, 2025),
  ('2025-01-03', 'Ingredientes', 'Compra carne de res y pan', 120.50, 1, 2025),
  ('2025-01-05', 'Servicios', 'Factura electricidad', 85, 1, 2025),
  ('2025-01-05', 'Servicios', 'Factura gas', 45, 1, 2025),
  ('2025-01-08', 'Ingredientes', 'Compra vegetales y condimentos', 35, 1, 2025),
  ('2025-01-10', 'Personal', 'Sueldos semana 1', 400, 1, 2025),
  ('2025-01-12', 'Ingredientes', 'Compra bebidas y desechables', 60, 1, 2025),
  ('2025-01-15', 'Mantenimiento', 'Reparacion freidora', 75, 1, 2025),
  ('2025-01-17', 'Personal', 'Sueldos semana 2', 400, 1, 2025),
  ('2025-01-20', 'Ingredientes', 'Compra semanal ingredientes', 95, 1, 2025),
  ('2025-01-22', 'Servicios', 'Internet y telefono', 30, 1, 2025),
  ('2025-01-24', 'Personal', 'Sueldos semana 3', 400, 1, 2025),
  ('2025-01-26', 'Marketing', 'Publicidad redes sociales', 50, 1, 2025),
  ('2025-01-28', 'Ingredientes', 'Compra semanal ingredientes', 110, 1, 2025),
  ('2025-01-31', 'Personal', 'Sueldos semana 4', 400, 1, 2025);
