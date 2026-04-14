-- Script para crear la tabla merma desde cero
-- Ejecutar esto en el SQL Editor de Supabase

-- 1. Crear la tabla merma si no existe
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

-- 2. Habilitar RLS
ALTER TABLE merma ENABLE ROW LEVEL SECURITY;

-- 3. Crear política de acceso público (como las otras tablas)
DROP POLICY IF EXISTS "Allow all" ON merma;
CREATE POLICY "Allow all" ON merma FOR ALL USING (true) WITH CHECK (true);

-- 4. Verificar que la tabla fue creada correctamente
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'merma'
ORDER BY ordinal_position;
