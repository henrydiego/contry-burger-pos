-- =============================================
-- RESTAURAR PEDIDOS - Contry Burger
-- =============================================

-- 1. Verificar si la tabla tiene datos
DO $$
DECLARE
  count_pedidos INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_pedidos FROM pedidos;

  IF count_pedidos = 0 THEN
    RAISE NOTICE 'La tabla pedidos esta vacia. Insertando datos de prueba...';

    -- Insertar pedidos de prueba
    INSERT INTO pedidos (order_id, cliente_nombre, cliente_telefono, items, total, estado, metodo_pago, notas, fecha, hora, pago_verificado, calificado) VALUES
    ('#1', 'Juan Perez', '555-0101', '[{"nombre": "Hamburguesa Clasica", "cantidad": 2, "subtotal": 15.98}]'::jsonb, 15.98, 'pendiente', 'efectivo', 'Sin cebolla', CURRENT_DATE, CURRENT_TIME, false, false),
    ('#2', 'Maria Garcia', '555-0102', '[{"nombre": "Hamburguesa Doble", "cantidad": 1, "subtotal": 10.99}]'::jsonb, 10.99, 'preparando', 'qr', 'Pago pendiente', CURRENT_DATE, CURRENT_TIME, false, false),
    ('#3', 'Carlos Lopez', '555-0103', '[{"nombre": "Combo 1", "cantidad": 1, "subtotal": 10.99}]'::jsonb, 10.99, 'listo', 'efectivo', '', CURRENT_DATE, CURRENT_TIME, true, false),
    ('#4', 'Ana Martinez', '555-0104', '[{"nombre": "Hot Dog Especial", "cantidad": 3, "subtotal": 17.97}]'::jsonb, 17.97, 'entregado', 'tarjeta', '', CURRENT_DATE - 1, '14:30:00', true, true),
    ('#5', 'Pedro Sanchez', '555-0105', '[{"nombre": "Papas Fritas Grandes", "cantidad": 2, "subtotal": 6.98}]'::jsonb, 6.98, 'cancelado', 'efectivo', 'Cliente cancelo', CURRENT_DATE - 1, '16:00:00', false, false);

    RAISE NOTICE 'Pedidos de prueba insertados correctamente.';
  ELSE
    RAISE NOTICE 'La tabla pedidos ya tiene % registros.', count_pedidos;
  END IF;
END $$;

-- 2. Verificar que los pedidos existen
SELECT id, order_id, cliente_nombre, estado, total, fecha
FROM pedidos
ORDER BY id
LIMIT 10;
