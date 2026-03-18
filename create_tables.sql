CREATE TABLE IF NOT EXISTS configuracion (id INTEGER PRIMARY KEY DEFAULT 1, qr_pago_url TEXT DEFAULT '', instrucciones_pago TEXT DEFAULT '', hora_apertura TEXT DEFAULT '08:00', hora_cierre TEXT DEFAULT '22:00', abierto BOOLEAN DEFAULT true, tiempo_estimado TEXT DEFAULT '30-45 min', costo_envio NUMERIC DEFAULT 0, pedido_minimo NUMERIC DEFAULT 0, mensaje_bienvenida TEXT DEFAULT '', whatsapp_phone TEXT DEFAULT '');
INSERT INTO configuracion (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS cupones (id SERIAL PRIMARY KEY, codigo TEXT UNIQUE NOT NULL, tipo TEXT DEFAULT 'fijo', valor NUMERIC DEFAULT 0, usos_max INTEGER DEFAULT 100, usos_actuales INTEGER DEFAULT 0, activo BOOLEAN DEFAULT true, fecha_vencimiento DATE);
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON configuracion;
CREATE POLICY "Allow all" ON configuracion FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE cupones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON cupones;
CREATE POLICY "Allow all" ON cupones FOR ALL USING (true) WITH CHECK (true);
