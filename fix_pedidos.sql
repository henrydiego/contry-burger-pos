-- =============================================
-- FIX: Verificar y reparar tabla pedidos
-- =============================================

-- 1. Verificar estructura de la tabla pedidos
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'pedidos'
ORDER BY ordinal_position;

-- 2. Contar cuántos pedidos existen
SELECT COUNT(*) as total_pedidos FROM pedidos;

-- 3. Ver últimos pedidos (si existen)
SELECT id, order_id, cliente_nombre, estado, total, fecha, hora
FROM pedidos
ORDER BY id DESC
LIMIT 10;

-- 4. Insertar pedido de prueba si la tabla está vacía
-- Descomenta las siguientes líneas si quieres crear un pedido de prueba:
/*
INSERT INTO pedidos (
  order_id, cliente_nombre, cliente_telefono, items, total, estado, metodo_pago, notas, fecha, hora
) VALUES (
  '#100',
  'Cliente de Prueba',
  '999-999-999',
  '[{"nombre": "Hamburguesa Clasica", "cantidad": 1, "subtotal": 7.99}]'::jsonb,
  7.99,
  'pendiente',
  'efectivo',
  'Pedido de prueba',
  CURRENT_DATE,
  CURRENT_TIME
);
*/

-- 5. Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'pedidos';
