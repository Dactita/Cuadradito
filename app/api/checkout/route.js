import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

const SIZE = 40;
const TOTAL = SIZE * SIZE;
const PRICE = Number(process.env.NEXT_PUBLIC_PRICE_PER_CELL || 500);

export async function POST(request) {
  try {
    const body = await request.json();
    const indices = Array.isArray(body.indices) ? [...new Set(body.indices)] : [];
    const color = typeof body.color === 'string' ? body.color : '#3ECF8E';
    const owner = typeof body.owner === 'string' ? body.owner.trim().slice(0, 18) : '';

    if (indices.length === 0) {
      return NextResponse.json({ error: 'No seleccionaste ninguna celda.' }, { status: 400 });
    }
    for (const i of indices) {
      if (!Number.isInteger(i) || i < 0 || i >= TOTAL) {
        return NextResponse.json({ error: 'Selección inválida.' }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();

    // Chequeamos que nadie haya comprado alguna de estas celdas mientras tanto
    const { data: existing, error: existingError } = await supabase
      .from('cells')
      .select('index')
      .in('index', indices);
    if (existingError) throw existingError;
    if ((existing || []).length > 0) {
      return NextResponse.json(
        { error: 'Alguien ya pintó alguna de esas celdas. Elegí otras.' },
        { status: 409 }
      );
    }

    const amount = indices.length * PRICE;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ indices, color, owner, amount, status: 'pending' })
      .select()
      .single();
    if (orderError) throw orderError;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken || !siteUrl) {
      return NextResponse.json(
        { error: 'Falta configurar Mercado Pago en el servidor.' },
        { status: 500 }
      );
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: `PixelDeck — ${indices.length} celda${indices.length > 1 ? 's' : ''}`,
            quantity: 1,
            unit_price: amount,
            currency_id: 'ARS',
          },
        ],
        external_reference: order.id,
        back_urls: {
          success: `${siteUrl}/?status=success`,
          failure: `${siteUrl}/?status=failure`,
          pending: `${siteUrl}/?status=pending`,
        },
        auto_return: 'approved',
        notification_url: `${siteUrl}/api/webhook`,
      }),
    });

    const preference = await mpRes.json();
    if (!mpRes.ok) {
      console.error('Mercado Pago error', preference);
      return NextResponse.json({ error: 'Mercado Pago rechazó la solicitud.' }, { status: 502 });
    }

    return NextResponse.json({ initPoint: preference.init_point });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error inesperado creando el pago.' }, { status: 500 });
  }
}
