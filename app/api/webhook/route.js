import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

// Mercado Pago a veces prueba la URL con un GET simple.
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    let paymentId = url.searchParams.get('data.id') || url.searchParams.get('id');
    let topic = url.searchParams.get('type') || url.searchParams.get('topic');

    if (!paymentId) {
      try {
        const body = await request.json();
        if (body?.data?.id) paymentId = body.data.id;
        if (body?.type) topic = body.type;
      } catch {
        // sin body en la notificación, no pasa nada
      }
    }

    // Si no es una notificación de pago, la confirmamos igual y salimos
    if (topic !== 'payment' || !paymentId) {
      return NextResponse.json({ ok: true });
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await mpRes.json();

    if (payment.status !== 'approved') {
      return NextResponse.json({ ok: true });
    }

    const orderId = payment.external_reference;
    if (!orderId) return NextResponse.json({ ok: true });

    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (orderError || !order) return NextResponse.json({ ok: true });

    // Ya la habíamos procesado antes (Mercado Pago puede reenviar el mismo aviso)
    if (order.status === 'approved') {
      return NextResponse.json({ ok: true });
    }

    const rows = order.indices.map((index) => ({
      index,
      color: order.color,
      owner: order.owner,
      order_id: order.id,
      painted_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('cells')
      .upsert(rows, { onConflict: 'index', ignoreDuplicates: true });
    if (insertError) console.error(insertError);

    await supabase
      .from('orders')
      .update({ status: 'approved', mp_payment_id: String(paymentId) })
      .eq('id', orderId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    // Siempre respondemos 200 para que Mercado Pago no reintente en loop
    return NextResponse.json({ ok: true });
  }
}
