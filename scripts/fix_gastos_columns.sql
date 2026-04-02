-- Fix: Agregar columnas faltantes a tabla gastos
-- La tabla original tiene tipo/descripcion pero el código usa concepto/categoria
-- Ejecutar en Supabase SQL Editor

ALTER TABLE gastos ADD COLUMN IF NOT EXISTS concepto TEXT DEFAULT '';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT '';
