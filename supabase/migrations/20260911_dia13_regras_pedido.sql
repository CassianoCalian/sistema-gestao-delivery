BEGIN;

-- ============================================================
-- DIA 13 - REGRAS DE PEDIDO
-- ============================================================
-- 1. Pedido mínimo de R$ 30,00
-- 2. Exceção configurável por produto
-- 3. Taxa de R$ 2,00 para pagamento em cartão na entrega
-- 4. Suporte da exceção no painel administrativo
-- ============================================================


-- ============================================================
-- COLUNAS
-- ============================================================

ALTER TABLE public.produtos
ADD COLUMN IF NOT EXISTS permite_abaixo_minimo boolean NOT NULL DEFAULT false;

ALTER TABLE public.pedidos
ADD COLUMN IF NOT EXISTS taxa_cartao numeric NOT NULL DEFAULT 0;


-- ============================================================
-- ATUALIZAÇÃO DE PRODUTO PELO ADMIN
-- ============================================================

CREATE OR REPLACE FUNCTION public.atualizar_produto_admin(
  p_produto_id bigint,
  p_nome text,
  p_descricao text,
  p_categoria_id bigint,
  p_preco numeric,
  p_preco_promocional numeric,
  p_estoque integer,
  p_imagem_url text,
  p_ativo boolean,
  p_destaque boolean,
  p_em_promocao boolean,
  p_estoque_minimo integer,
  p_permite_abaixo_minimo boolean
)
RETURNS TABLE(
  id bigint,
  nome text,
  descricao text,
  preco numeric,
  preco_promocional numeric,
  estoque integer,
  estoque_minimo integer,
  imagem_url text,
  ativo boolean,
  destaque boolean,
  em_promocao boolean,
  permite_abaixo_minimo boolean,
  categoria_id bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_estoque_anterior integer;
  v_diferenca integer;
begin

  ----------------------------------------------------
  -- 1. Validações
  ----------------------------------------------------

  if p_estoque < 0 then
    raise exception 'ESTOQUE_INVALIDO';
  end if;

  if p_estoque_minimo < 0 then
    raise exception 'ESTOQUE_MINIMO_INVALIDO';
  end if;


  ----------------------------------------------------
  -- 2. Busca e bloqueia o produto
  ----------------------------------------------------

  select p.estoque
  into v_estoque_anterior
  from produtos p
  where p.id = p_produto_id
  for update;

  if not found then
    raise exception 'PRODUTO_NAO_ENCONTRADO';
  end if;


  ----------------------------------------------------
  -- 3. Calcula diferença de estoque
  ----------------------------------------------------

  v_diferenca := p_estoque - v_estoque_anterior;


  ----------------------------------------------------
  -- 4. Atualiza produto
  ----------------------------------------------------

  update produtos p
  set
    nome = p_nome,
    descricao = p_descricao,
    categoria_id = p_categoria_id,
    preco = p_preco,
    preco_promocional = p_preco_promocional,
    estoque = p_estoque,
    estoque_minimo = p_estoque_minimo,
    imagem_url = p_imagem_url,
    ativo = p_ativo,
    destaque = p_destaque,
    em_promocao = p_em_promocao,
    permite_abaixo_minimo = coalesce(p_permite_abaixo_minimo, false)
  where p.id = p_produto_id;


  ----------------------------------------------------
  -- 5. Registra ajuste de estoque
  ----------------------------------------------------

  if v_diferenca <> 0 then

    insert into movimentacoes_estoque (
      produto_id,
      pedido_id,
      tipo,
      quantidade,
      estoque_anterior,
      estoque_novo,
      observacao
    )
    values (
      p_produto_id,
      null,
      'ajuste_manual',
      v_diferenca,
      v_estoque_anterior,
      p_estoque,
      'Ajuste manual pelo painel administrativo'
    );

  end if;


  ----------------------------------------------------
  -- 6. Retorna produto atualizado
  ----------------------------------------------------

  return query
  select
    p.id,
    p.nome,
    p.descricao,
    p.preco,
    p.preco_promocional,
    p.estoque,
    p.estoque_minimo,
    p.imagem_url,
    p.ativo,
    p.destaque,
    p.em_promocao,
    p.permite_abaixo_minimo,
    p.categoria_id
  from produtos p
  where p.id = p_produto_id;

end;
$function$;


-- ============================================================
-- CRIAÇÃO DE PEDIDO / ESTOQUE / PEDIDO MÍNIMO / TAXA CARTÃO
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
  -- 10. Cria cliente
  ----------------------------------------------------

  insert into clientes (
    nome,
    telefone
  )
  values (
    trim(p_nome),
    trim(p_telefone)
  )
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
  -- 15. Retorna o pedido criado
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