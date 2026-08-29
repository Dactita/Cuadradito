import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('cells')
      .select('index, color, owner, painted_at')
      .order('painted_at', { ascending: false });

    if (error) throw error;

    const recentSales = (data || []).slice(0, 30);
    return NextResponse.json({ cells: data || [], recentSales });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'No se pudo leer el mural.' }, { status: 500 });
  }
}
