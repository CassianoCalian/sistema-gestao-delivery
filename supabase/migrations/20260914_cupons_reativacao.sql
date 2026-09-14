-- =========================================================
-- DEPÓSITO DO ZÉ
-- CUPONS PERSONALIZADOS DE REATIVAÇÃO
-- 2026-09-14
-- =========================================================

create table if not exists public.cupons (
  id uuid primary key default gen_random_uuid(),

  created_at timestamptz not null default now(),

  cliente_id bigint not null
    references public.clientes(id)
    on delete cascade,

  codigo text not null,

  tipo text not null default 'percentual'
    check (tipo in ('percentual')),

  percentual numeric(5,2) not null default 5.00
    check (percentual > 0 and percentual <= 100),

  desconto_maximo numeric(10,2) not null default 10.00
    check (desconto_maximo >= 0),

  valor_minimo_pedido numeric(10,2) not null default 30.00
    check (valor_minimo_pedido >= 0),

  motivo text not null default 'reativacao',

  valido_ate timestamptz not null,

  ativo boolean not null default true,

  usado_em timestamptz,

  pedido_id_usado bigint unique
    references public.pedidos(id)
    on delete set null,

  constraint cupons_codigo_nao_vazio
    check (length(trim(codigo)) >= 6),

  constraint cupons_codigo_maiusculo
    check (codigo = upper(codigo))
);

create unique index if not exists cupons_codigo_unique
  on public.cupons (upper(codigo));

create index if not exists cupons_cliente_id_idx
  on public.cupons (cliente_id);

create index if not exists cupons_validade_idx
  on public.cupons (valido_ate);

create index if not exists cupons_reativacao_cliente_idx
  on public.cupons (cliente_id, motivo, ativo);

-- =========================================================
-- RASTREIO DO CUPOM NO PEDIDO
-- =========================================================

alter table public.pedidos
  add column if not exists cupom_id uuid
    references public.cupons(id)
    on delete set null;

alter table public.pedidos
  add column if not exists codigo_cupom text;

alter table public.pedidos
  add column if not exists desconto_cupom numeric(10,2)
    not null default 0;

alter table public.pedidos
  drop constraint if exists pedidos_desconto_cupom_check;

alter table public.pedidos
  add constraint pedidos_desconto_cupom_check
    check (desconto_cupom >= 0);

-- =========================================================
-- SEGURANÇA
-- =========================================================

alter table public.cupons enable row level security;

revoke all on table public.cupons
  from anon, authenticated;

grant select, insert, update, delete
  on table public.cupons
  to service_role;