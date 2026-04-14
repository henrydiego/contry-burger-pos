-- =============================================
-- CREAR TABLA MERMA - CONTRY BURGER
-- Copiar TODO esto en el SQL Editor de Supabase
-- =============================================

-- 1. Crear la tabla merma (solo si no existe)
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

-- 2. Habilitar permisos (RLS) - IMPORTANTE
ALTER TABLE merma ENABLE ROW LEVEL SECURITY;

-- 3. Crear política para permitir acceso
DROP POLICY IF EXISTS "Allow all" ON merma;
CREATE POLICY "Allow all" ON merma FOR ALL USING (true) WITH CHECK (true);
