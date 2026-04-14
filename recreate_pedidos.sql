-- =============================================
-- RESTAURAR TABLA PEDIDOS - Contry Burger
-- =============================================

-- 1. Primero hacer backup si hay datos (opcional)
-- CREATE TABLE IF NOT EXISTS pedidos_backup AS SELECT * FROM pedidos;

-- 2. Eliminar tabla existente (CUIDADO: esto borra todos los datos)
-- DESCOMENTA LA SIGUIENTE LÍNEA SOLO SI ESTÁS SEGURO:
-- DROP TABLE IF EXISTS pedidos CASCADE;

-- 3. Crear tabla pedidos con estructura correcta
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  order_id TEXT UNIQUE,
  cliente_nombre TEXT DEFAULT '',
  cliente_telefono TEXT DEFAULT '',
  cliente_email TEXT DEFAULT NULL,
  user_id UUID DEFAULT NULL,
  items JSONB DEFAULT '[]',
  total NUMERIC DEFAULT 0,
  estado TEXT DEFAULT 'pendiente',
  metodo_pago TEXT DEFAULT 'efectivo',
  pago_verificado BOOLEAN DEFAULT false,
  calificado BOOLEAN DEFAULT false,
  notas TEXT DEFAULT '',
  direccion TEXT DEFAULT NULL,
  latitud NUMERIC DEFAULT NULL,
  longitud NUMERIC DEFAULT NULL,
  descuento NUMERIC DEFAULT 0,
  cupon_codigo TEXT DEFAULT NULL,
  costo_envio_aplicado NUMERIC DEFAULT 0,
  hora_recojo TEXT DEFAULT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  hora TIME DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_pedidos_order_id ON pedidos(order_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_user_id ON pedidos(user_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha);

-- 5. Habilitar RLS
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- 6. Eliminar políticas existentes y crear nuevas
DROP POLICY IF EXISTS "Allow all" ON pedidos;
DROP POLICY IF EXISTS "Enable read access for all users" ON pedidos;
DROP POLICY IF EXISTS "Enable insert access for all users" ON pedidos;
DROP POLICY IF EXISTS "Enable update access for all users" ON pedidos;

-- Política permisiva para desarrollo (cambiar para producción)
CREATE POLICY "Allow all" ON pedidos FOR ALL USING (true) WITH CHECK (true);

-- 7. Insertar pedidos de prueba
INSERT INTO pedidos (order_id, cliente_nombre, cliente_telefono, items, total, estado, metodo_pago, notas, pago_verificado, calificado) VALUES
('#1', 'Juan Perez', '555-0101', '[{"nombre": "Hamburguesa Clasica", "cantidad": 2, "subtotal": 15.98}]'::jsonb, 15.98, 'pendiente', 'efectivo', 'Sin cebolla', false, false),
('#2', 'Maria Garcia', '555-0102', '[{"nombre": "Hamburguesa Doble", "cantidad": 1, "subtotal": 10.99}]'::jsonb, 10.99, 'preparando', 'qr', 'Pago pendiente', false, false),
('#3', 'Carlos Lopez', '555-0103', '[{"nombre": "Combo 1", "cantidad": 1, "subtotal": 10.99}]'::jsonb, 10.99, 'listo', 'efectivo', '', true, false),
('#4', 'Ana Martinez', '555-0104', '[{"nombre": "Hot Dog Especial", "cantidad": 3, "subtotal": 17.97}]'::jsonb, 17.97, 'entregado', 'tarjeta', '', true, true),
('#5', 'Pedro Sanchez', '555-0105', '[{"nombre": "Papas Fritas Grandes", "cantidad": 2, "subtotal": 6.98}]'::jsonb, 6.98, 'cancelado', 'efectivo', 'Cliente cancelo', false, false)
ON CONFLICT (order_id) DO NOTHING;

-- 8. Verificar que los pedidos se insertaron
SELECT 'Pedidos insertados: ' || COUNT(*)::text as resultado FROM pedidos;

-- 9. Mostrar los pedidos creados
SELECT id, order_id, cliente_nombre, estado, total, metodo_pago
FROM pedidos
ORDER BY id;
