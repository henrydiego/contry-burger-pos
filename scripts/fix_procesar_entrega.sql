-- =============================================
-- FIX: procesar_entrega - agregar validaciones de seguridad
-- Bug: permitía entregar pedidos cancelados y QR sin verificar
-- =============================================

CREATE OR REPLACE FUNCTION procesar_entrega(p_pedido_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pedido RECORD;
  v_item RECORD;
BEGIN
  -- 1. Obtener pedido
  SELECT * INTO v_pedido FROM pedidos WHERE id = p_pedido_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Pedido no encontrado');
  END IF;

  -- 2. Validar que no esté cancelado
  IF v_pedido.estado = 'cancelado' THEN
    RETURN json_build_object('ok', false, 'error', 'No se puede entregar un pedido cancelado');
  END IF;

  -- 3. Validar que no esté ya entregado
  IF v_pedido.estado = 'entregado' THEN
    RETURN json_build_object('ok', false, 'error', 'El pedido ya fue entregado');
  END IF;

  -- 4. Validar pago QR verificado
  IF v_pedido.metodo_pago = 'qr' AND v_pedido.pago_verificado = false THEN
    RETURN json_build_object('ok', false, 'error', 'El pago QR no ha sido verificado');
  END IF;

  -- 5. Registrar cada item como venta
  FOR v_item IN
    SELECT * FROM json_array_elements(v_pedido.items::json) AS item
  LOOP
    INSERT INTO ventas (
      order_id, producto_id, producto, categoria,
      cantidad, precio_unitario, precio, total,
      metodo_pago, estado, cajero, fecha, hora
    ) VALUES (
      v_pedido.order_id,
      v_item.value->>'producto_id',
      v_item.value->>'nombre',
      COALESCE(
        (SELECT categoria FROM productos WHERE id = v_item.value->>'producto_id'),
        'Sin categoria'
      ),
      (v_item.value->>'cantidad')::INTEGER,
      (v_item.value->>'precio_unitario')::NUMERIC,
      (v_item.value->>'precio_unitario')::NUMERIC,
      (v_item.value->>'subtotal')::NUMERIC,
      v_pedido.metodo_pago,
      'Pagado',
      '',
      v_pedido.fecha,
      v_pedido.hora
    );
  END LOOP;

  -- 6. Marcar pedido como entregado
  UPDATE pedidos SET estado = 'entregado' WHERE id = p_pedido_id;

  RETURN json_build_object('ok', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;


-- =============================================
-- FIX: Crear función incrementar_uso_cupon (no existía)
-- Necesaria para que los cupones descuenten usos correctamente
-- =============================================

CREATE OR REPLACE FUNCTION incrementar_uso_cupon(p_codigo TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cupones
  SET usos_actuales = usos_actuales + 1
  WHERE codigo = p_codigo;
END;
$$;
