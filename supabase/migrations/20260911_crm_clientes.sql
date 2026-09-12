BEGIN;

-- ============================================================
-- CRM DE CLIENTES
-- ============================================================
-- 1. Normaliza o telefone/WhatsApp dos clientes
-- 2. Consolida automaticamente cadastros duplicados
-- 3. Preserva todos os pedidos existentes
-- 4. Impede novos clientes duplicados
-- 5. Faz novos pedidos reutilizarem o cliente pelo telefone
-- ============================================================


-- ============================================================
-- 1. TELEFONE NORMALIZADO
-- ============================================================

ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS telefone_normalizado text
GENERATED ALWAYS AS (
  CASE
    WHEN length(regexp_replace(telefone, '\D', '', 'g')) IN (12, 13)
      AND regexp_replace(telefone, '\D', '', 'g') LIKE '55%'
    THEN substr(regexp_replace(telefone, '\D', '', 'g'), 3)
    ELSE regexp_replace(telefone, '\D', '', 'g')
  END
) STORED;


-- ============================================================
-- 2. CONSOLIDA CLIENTES DUPLICADOS
-- ============================================================
-- Para cada telefone repetido:
-- - mantém o cliente de menor ID;
-- - move os pedidos dos duplicados para ele;
-- - depois remove os registros duplicados.
--
-- Os nomes históricos continuam preservados em
-- pedidos.nome_cliente.
-- ============================================================

WITH grupos AS (
  SELECT
    telefone_normalizado,
    MIN(id) AS cliente_principal_id
  FROM public.clientes
  GROUP BY telefone_normalizado
  HAVING COUNT(*) > 1
),
duplicados AS (
  SELECT
    c.id AS cliente_duplicado_id,
    g.cliente_principal_id
  FROM public.clientes c
  JOIN grupos g
    ON g.telefone_normalizado = c.telefone_normalizado
  WHERE c.id <> g.cliente_principal_id
)
UPDATE public.pedidos p
SET cliente_id = d.cliente_principal_id
FROM duplicados d
WHERE p.cliente_id = d.cliente_duplicado_id;


WITH grupos AS (
  SELECT
    telefone_normalizado,
    MIN(id) AS cliente_principal_id
  FROM public.clientes
  GROUP BY telefone_normalizado
  HAVING COUNT(*) > 1
)
DELETE FROM public.clientes c
USING grupos g
WHERE c.telefone_normalizado = g.telefone_normalizado
  AND c.id <> g.cliente_principal_id;


-- ============================================================
-- 3. IMPEDE DUPLICAÇÃO FUTURA
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.clientes'::regclass
      AND conname = 'clientes_telefone_normalizado_unique'
  ) THEN

    ALTER TABLE public.clientes
    ADD CONSTRAINT clientes_telefone_normalizado_unique
    UNIQUE (telefone_normalizado);

  END IF;
END
$$;


-- ============================================================
-- 4. CRIAÇÃO DE PEDIDOS
-- ============================================================
-- Mantém todas as regras já existentes:
-- estoque, promoções, pedido mínimo, taxa do cartão etc.
--
-- A mudança do CRM está no passo 10:
-- reutiliza um cliente existente pelo telefone normalizado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_pedido_com_estoque(
  p_nome text,
  p_telefone text,
  p_cep text,
  p_rua text,
  p_numero text,
  p_complemento text,
  p_bairro text,
  p_referencia text,
  p_forma_pagamento text,
  p_troco_para numeric,
  p_itens jsonb
)
RETURNS TABLE(
  pedido_id bigint,
  codigo_acesso uuid,
  subtotal numeric,
  taxa_entrega numeric,
  total numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_cliente_id bigint;
  v_pedido_id bigint;
  v_codigo_acesso uuid;

  v_subtotal numeric := 0;
  v_taxa_entrega numeric := 0;
  v_taxa_cartao numeric := 0;
  v_total numeric := 0;

  v_permite_abaixo_minimo boolean := false;

  v_quantidade_solicitada integer;
  v_quantidade_encontrada integer;

  v_nome_produto text;
  v_estoque_disponivel integer;
  v_quantidade_produto integer;
begin

  ----------------------------------------------------
  -- 1. Valida os itens
  ----------------------------------------------------

  if p_itens is null
     or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 then

    raise exception 'CARRINHO_VAZIO';

  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
    where item.id is null
       or item.quantidade is null
       or item.quantidade <= 0
  ) then

    raise exception 'ITEM_INVALIDO';

  end if;


  ----------------------------------------------------
  -- 2. Bloqueia os produtos
  ----------------------------------------------------

  perform p.id
  from produtos p
  join (
    select
      item.id as produto_id,
      sum(item.quantidade)::integer as quantidade
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
    group by item.id
  ) itens
    on itens.produto_id = p.id
  order by p.id
  for update of p;


  ----------------------------------------------------
  -- 3. Confere se todos existem
  ----------------------------------------------------

  select count(*)
  into v_quantidade_solicitada
  from (
    select distinct item.id
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
  ) solicitados;

  select count(*)
  into v_quantidade_encontrada
  from produtos p
  join (
    select distinct item.id
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
  ) solicitados
    on solicitados.id = p.id;

  if v_quantidade_encontrada <> v_quantidade_solicitada then
    raise exception 'PRODUTO_NAO_ENCONTRADO';
  end if;


  ----------------------------------------------------
  -- 4. Confere produtos inativos
  ----------------------------------------------------

  select p.nome
  into v_nome_produto
  from produtos p
  join (
    select distinct item.id
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
  ) solicitados
    on solicitados.id = p.id
  where p.ativo = false
  limit 1;

  if found then
    raise exception 'PRODUTO_INATIVO:%', v_nome_produto;
  end if;


  ----------------------------------------------------
  -- 5. Confere estoque
  ----------------------------------------------------

  select
    p.nome,
    p.estoque,
    itens.quantidade
  into
    v_nome_produto,
    v_estoque_disponivel,
    v_quantidade_produto
  from produtos p
  join (
    select
      item.id as produto_id,
      sum(item.quantidade)::integer as quantidade
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
    group by item.id
  ) itens
    on itens.produto_id = p.id
  where p.estoque < itens.quantidade
  limit 1;

  if found then
    raise exception
      'ESTOQUE_INSUFICIENTE:%:%',
      v_nome_produto,
      v_estoque_disponivel;
  end if;


  ----------------------------------------------------
  -- 6. Calcula subtotal
  ----------------------------------------------------

  select coalesce(
    sum(
      (
        case
          when p.em_promocao = true
            and p.preco_promocional is not null
          then p.preco_promocional
          else p.preco
        end
      ) * itens.quantidade
    ),
    0
  )
  into v_subtotal
  from produtos p
  join (
    select
      item.id as produto_id,
      sum(item.quantidade)::integer as quantidade
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
    group by item.id
  ) itens
    on itens.produto_id = p.id;


  ----------------------------------------------------
  -- 7. Verifica exceção ao pedido mínimo
  ----------------------------------------------------

  select coalesce(
    bool_or(p.permite_abaixo_minimo),
    false
  )
  into v_permite_abaixo_minimo
  from produtos p
  join (
    select distinct item.id as produto_id
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
  ) itens
    on itens.produto_id = p.id;


  ----------------------------------------------------
  -- 8. Valida pedido mínimo
  ----------------------------------------------------

  if v_subtotal < 30
     and not v_permite_abaixo_minimo then

    raise exception 'PEDIDO_MINIMO:30';

  end if;


  ----------------------------------------------------
  -- 9. Calcula taxas e total
  ----------------------------------------------------

  v_taxa_entrega := 0;

  if p_forma_pagamento = 'cartao_entrega' then
    v_taxa_cartao := 2;
  else
    v_taxa_cartao := 0;
  end if;

  v_total :=
    v_subtotal
    + v_taxa_entrega
    + v_taxa_cartao;


  ----------------------------------------------------
  -- 10. Reutiliza ou cria cliente pelo telefone
  ----------------------------------------------------

  insert into clientes (
    nome,
    telefone
  )
  values (
    trim(p_nome),
    trim(p_telefone)
  )
  on conflict (telefone_normalizado)
  do update
  set
    nome = excluded.nome,
    telefone = excluded.telefone
  returning id
  into v_cliente_id;


  ----------------------------------------------------
  -- 11. Cria pedido
  ----------------------------------------------------

  insert into pedidos (
    cliente_id,
    nome_cliente,
    telefone,
    cep,
    rua,
    numero,
    complemento,
    bairro,
    referencia,
    forma_pagamento,
    troco_para,
    subtotal,
    taxa_entrega,
    taxa_cartao,
    total,
    status
  )
  values (
    v_cliente_id,
    trim(p_nome),
    trim(p_telefone),
    trim(p_cep),
    trim(p_rua),
    trim(p_numero),
    nullif(trim(p_complemento), ''),
    trim(p_bairro),
    nullif(trim(p_referencia), ''),
    p_forma_pagamento,

    case
      when p_forma_pagamento = 'dinheiro'
      then p_troco_para
      else null
    end,

    v_subtotal,
    v_taxa_entrega,
    v_taxa_cartao,
    v_total,
    'recebido'
  )
  returning
    id,
    pedidos.codigo_acesso
  into
    v_pedido_id,
    v_codigo_acesso;


  ----------------------------------------------------
  -- 12. Salva itens do pedido
  ----------------------------------------------------

  insert into itens_pedido (
    pedido_id,
    produto_id,
    nome_produto,
    preco_unitario,
    quantidade,
    subtotal
  )
  select
    v_pedido_id,
    p.id,
    p.nome,

    case
      when p.em_promocao = true
        and p.preco_promocional is not null
      then p.preco_promocional
      else p.preco
    end,

    itens.quantidade,

    (
      case
        when p.em_promocao = true
          and p.preco_promocional is not null
        then p.preco_promocional
        else p.preco
      end
    ) * itens.quantidade

  from produtos p
  join (
    select
      item.id as produto_id,
      sum(item.quantidade)::integer as quantidade
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
    group by item.id
  ) itens
    on itens.produto_id = p.id;


  ----------------------------------------------------
  -- 13. Registra a venda no histórico
  ----------------------------------------------------

  insert into movimentacoes_estoque (
    produto_id,
    pedido_id,
    tipo,
    quantidade,
    estoque_anterior,
    estoque_novo,
    observacao
  )
  select
    p.id,
    v_pedido_id,
    'venda',
    -itens.quantidade,
    p.estoque,
    p.estoque - itens.quantidade,
    'Venda do pedido #' || v_pedido_id

  from produtos p
  join (
    select
      item.id as produto_id,
      sum(item.quantidade)::integer as quantidade
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
    group by item.id
  ) itens
    on itens.produto_id = p.id;


  ----------------------------------------------------
  -- 14. Baixa o estoque
  ----------------------------------------------------

  update produtos p
  set estoque = p.estoque - itens.quantidade
  from (
    select
      item.id as produto_id,
      sum(item.quantidade)::integer as quantidade
    from jsonb_to_recordset(p_itens)
      as item(id bigint, quantidade integer)
    group by item.id
  ) itens
  where p.id = itens.produto_id;


  ----------------------------------------------------
  -- 15. Retorna pedido criado
  ----------------------------------------------------

  return query
  select
    v_pedido_id,
    v_codigo_acesso,
    v_subtotal,
    v_taxa_entrega,
    v_total;

end;
$function$;

COMMIT;