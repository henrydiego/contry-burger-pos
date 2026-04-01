-- =============================================
-- FIX 1: Arreglar RLS de chat_mensajes
-- El INSERT esta bloqueado para anon key, impidiendo que el chat funcione
-- =============================================

-- Eliminar politica actual que solo permite SELECT
DROP POLICY IF EXISTS "Allow all chat" ON chat_mensajes;

-- Crear politicas separadas que permitan todo
CREATE POLICY "chat_select" ON chat_mensajes FOR SELECT USING (true);
CREATE POLICY "chat_insert" ON chat_mensajes FOR INSERT WITH CHECK (true);
CREATE POLICY "chat_update" ON chat_mensajes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "chat_delete" ON chat_mensajes FOR DELETE USING (true);


-- =============================================
-- FIX 2: Crear tabla resenas (no existe)
-- La pagina de seguimiento intenta insertar calificaciones ahi
-- =============================================

CREATE TABLE IF NOT EXISTS resenas (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comentario TEXT,
  cliente_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resenas_pedido_id ON resenas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_resenas_order_id ON resenas(order_id);

-- RLS para resenas
ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resenas_select" ON resenas FOR SELECT USING (true);
CREATE POLICY "resenas_insert" ON resenas FOR INSERT WITH CHECK (true);
