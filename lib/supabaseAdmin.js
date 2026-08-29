import { createClient } from '@supabase/supabase-js';

// Este cliente usa la clave "service role", que tiene permisos totales.
// Por eso SOLO se usa acá, del lado del servidor (en las rutas /api),
// nunca en el navegador.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Faltan las variables de entorno de Supabase (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}
