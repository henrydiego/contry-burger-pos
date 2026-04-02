// Script para insertar pedidos de prueba en Supabase
// Uso: node scripts/seed-pedidos.js

require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

async function seedPedidos() {
  const pedidos = [
    {
      order_id: '#1',
      cliente_nombre: 'Juan Perez',
      cliente_telefono: '555-0101',
      items: [{ nombre: 'Hamburguesa Clasica', cantidad: 2, subtotal: 15.98 }],
      total: 15.98,
      estado: 'pendiente',
      metodo_pago: 'efectivo',
      notas: 'Sin cebolla',
      pago_verificado: false,
      calificado: false
    },
    {
      order_id: '#2',
      cliente_nombre: 'Maria Garcia',
      cliente_telefono: '555-0102',
      items: [{ nombre: 'Hamburguesa Doble', cantidad: 1, subtotal: 10.99 }],
      total: 10.99,
      estado: 'preparando',
      metodo_pago: 'qr',
      notas: 'Pago pendiente',
      pago_verificado: false,
      calificado: false
    },
    {
      order_id: '#3',
      cliente_nombre: 'Carlos Lopez',
      cliente_telefono: '555-0103',
      items: [{ nombre: 'Combo 1', cantidad: 1, subtotal: 10.99 }],
      total: 10.99,
      estado: 'listo',
      metodo_pago: 'efectivo',
      notas: '',
      pago_verificado: true,
      calificado: false
    },
    {
      order_id: '#4',
      cliente_nelefono: '555-0104',
      cliente_nombre: 'Ana Martinez',
      items: [{ nombre: 'Hot Dog Especial', cantidad: 3, subtotal: 17.97 }],
      total: 17.97,
      estado: 'entregado',
      metodo_pago: 'tarjeta',
      notas: '',
      pago_verificado: true,
      calificado: true
    }
  ];

  for (const pedido of pedidos) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/pedidos`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          ...pedido,
          fecha: new Date().toISOString().split('T')[0],
          hora: new Date().toTimeString().split(' ')[0]
        })
      });

      if (response.ok) {
        console.log(`✅ Pedido ${pedido.order_id} creado`);
      } else {
        const error = await response.text();
        console.error(`❌ Error creando pedido ${pedido.order_id}:`, error);
      }
    } catch (err) {
      console.error(`❌ Excepción con pedido ${pedido.order_id}:`, err.message);
    }
  }
}

seedPedidos();
