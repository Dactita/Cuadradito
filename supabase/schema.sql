-- Copiá y pegá todo esto en Supabase → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

-- Una fila por cada compra (aunque incluya varias celdas)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  indices integer[] not null,
  color text not null,
  owner text,
  amount numeric not null,
  status text not null default 'pending', -- pending | approved
  mp_payment_id text,
  created_at timestamptz not null default now()
);

-- Una fila por cada celda ya pintada (las que no se pintaron, no existen acá)
create table if not exists cells (
  index integer primary key,
  color text not null,
  owner text,
  order_id uuid references orders(id),
  painted_at timestamptz not null default now()
);
