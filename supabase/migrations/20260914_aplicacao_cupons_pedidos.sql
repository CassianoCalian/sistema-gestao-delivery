-- =========================================================
-- DEPÓSITO DO ZÉ
-- APLICAÇÃO SEGURA DE CUPONS NOS PEDIDOS
-- 2026-09-14
--
-- Mantém intactos os overloads existentes.
-- Cria:
-- 13 parâmetros -> benefícios: fidelidade OU cupom
-- 14 parâmetros -> benefícios + idempotência
-- =========================================================


-- =========================================================
-- 1. CAMADA DE BENEFÍCIOS
-- =========================================================

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
  p_itens jsonb,
  p_pontos_fidelidade integer,
  p_codigo_cupom text
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
DECLARE
  v_resultado record;

  v_codigo_cupom text;
  v_cupom record;

  v_cliente_id bigint;

  v_subtotal numeric;
  v_taxa_entrega numeric;
  v_taxa_cartao numeric;

  v_desconto_cupom numeric(12, 2);
  v_total_final numeric(12, 2);
BEGIN

  ----------------------------------------------------
  -- 1. Valida fidelidade
  ----------------------------------------------------

  IF p_pontos_fidelidade IS NULL
     OR p_pontos_fidelidade < 0 THEN

    RAISE EXCEPTION
      'PONTOS_FIDELIDADE_INVALIDOS';

  END IF;


  IF MOD(p_pontos_fidelidade, 500) <> 0 THEN

    RAISE EXCEPTION
      'PONTOS_FIDELIDADE_DEVE_SER_MULTIPLO_DE_500';

  END IF;


  ----------------------------------------------------
  -- 2. Normaliza cupom
  ----------------------------------------------------

  v_codigo_cupom :=
    NULLIF(
      UPPER(
        TRIM(
          COALESCE(p_codigo_cupom, '')
        )
      ),
      ''
    );


  ----------------------------------------------------
  -- 3. Sem cupom:
  -- mantém exatamente o fluxo atual da fidelidade
  ----------------------------------------------------

  IF v_codigo_cupom IS NULL THEN

    SELECT *
    INTO v_resultado
    FROM public.criar_pedido_com_estoque(
      p_nome,
      p_telefone,
      p_cep,
      p_rua,
      p_numero,
      p_complemento,
      p_bairro,
      p_referencia,
      p_forma_pagamento,
      p_troco_para,
      p_itens,
      p_pontos_fidelidade
    );


    RETURN QUERY
    SELECT
      v_resultado.pedido_id,
      v_resultado.codigo_acesso,
      v_resultado.subtotal,
      v_resultado.taxa_entrega,
      v_resultado.total;

    RETURN;

  END IF;


  ----------------------------------------------------
  -- 4. Cupom não acumula com resgate de pontos
  ----------------------------------------------------

  IF p_pontos_fidelidade > 0 THEN

    RAISE EXCEPTION
      'CUPOM_NAO_ACUMULA_FIDELIDADE';

  END IF;


  ----------------------------------------------------
  -- 5. Localiza e trava o cupom
  --
  -- FOR UPDATE impede duas compras simultâneas
  -- usando o mesmo cupom.
  ----------------------------------------------------

  SELECT
    c.id,
    c.cliente_id,
    c.codigo,
    c.tipo,
    c.percentual,
    c.desconto_maximo,
    c.valor_minimo_pedido,
    c.valido_ate,
    c.ativo,
    c.usado_em,
    c.pedido_id_usado
  INTO v_cupom
  FROM public.cupons c
  WHERE UPPER(c.codigo) = v_codigo_cupom
  FOR UPDATE;


  IF NOT FOUND THEN

    RAISE EXCEPTION
      'CUPOM_NAO_ENCONTRADO';

  END IF;


  ----------------------------------------------------
  -- 6. Confere disponibilidade
  ----------------------------------------------------

  IF v_cupom.ativo IS NOT TRUE
     OR v_cupom.usado_em IS NOT NULL
     OR v_cupom.pedido_id_usado IS NOT NULL THEN

    RAISE EXCEPTION
      'CUPOM_JA_UTILIZADO_OU_INATIVO';

  END IF;


  ----------------------------------------------------
  -- 7. Confere validade
  ----------------------------------------------------

  IF v_cupom.valido_ate <= NOW() THEN

    RAISE EXCEPTION
      'CUPOM_EXPIRADO';

  END IF;


  ----------------------------------------------------
  -- 8. Confere tipo suportado
  ----------------------------------------------------

  IF v_cupom.tipo <> 'percentual' THEN

    RAISE EXCEPTION
      'TIPO_CUPOM_NAO_SUPORTADO';

  END IF;


  ----------------------------------------------------
  -- 9. Cria o pedido com a lógica central existente
  --
  -- Tudo continua na MESMA transação.
  -- Se qualquer validação abaixo falhar,
  -- pedido, itens e estoque são revertidos.
  ----------------------------------------------------

  SELECT *
  INTO v_resultado
  FROM public.criar_pedido_com_estoque(
    p_nome,
    p_telefone,
    p_cep,
    p_rua,
    p_numero,
    p_complemento,
    p_bairro,
    p_referencia,
    p_forma_pagamento,
    p_troco_para,
    p_itens
  );


  ----------------------------------------------------
  -- 10. Obtém os dados oficiais do pedido
  ----------------------------------------------------

  SELECT
    p.cliente_id,
    p.subtotal,
    p.taxa_entrega,
    p.taxa_cartao
  INTO
    v_cliente_id,
    v_subtotal,
    v_taxa_entrega,
    v_taxa_cartao
  FROM public.pedidos p
  WHERE p.id = v_resultado.pedido_id
  FOR UPDATE;


  IF NOT FOUND THEN

    RAISE EXCEPTION
      'PEDIDO_NAO_ENCONTRADO_APOS_CRIACAO:%',
      v_resultado.pedido_id;

  END IF;


  ----------------------------------------------------
  -- 11. Cupom pertence somente ao cliente correto
  ----------------------------------------------------

  IF v_cliente_id <> v_cupom.cliente_id THEN

    RAISE EXCEPTION
      'CUPOM_NAO_PERTENCE_AO_CLIENTE';

  END IF;


  ----------------------------------------------------
  -- 12. Confere valor mínimo específico do cupom
  --
  -- É baseado no subtotal ORIGINAL dos produtos,
  -- antes do desconto.
  ----------------------------------------------------

  IF v_subtotal < v_cupom.valor_minimo_pedido THEN

    RAISE EXCEPTION
      'CUPOM_VALOR_MINIMO:%',
      v_cupom.valor_minimo_pedido;

  END IF;


  ----------------------------------------------------
  -- 13. Calcula desconto
  --
  -- 5% atualmente, respeitando desconto máximo.
  -- Nunca afeta taxa de cartão nem entrega.
  ----------------------------------------------------

  v_desconto_cupom :=
    LEAST(
      ROUND(
        v_subtotal *
        (v_cupom.percentual / 100),
        2
      ),
      v_cupom.desconto_maximo
    );


  IF v_desconto_cupom <= 0 THEN

    RAISE EXCEPTION
      'DESCONTO_CUPOM_INVALIDO';

  END IF;


  ----------------------------------------------------
  -- 14. Calcula total final
  ----------------------------------------------------

  v_total_final :=
      v_subtotal
    + v_taxa_entrega
    + v_taxa_cartao
    - v_desconto_cupom;


  ----------------------------------------------------
  -- 15. Registra o cupom no pedido
  ----------------------------------------------------

  UPDATE public.pedidos
  SET
    cupom_id = v_cupom.id,
    codigo_cupom = v_cupom.codigo,
    desconto_cupom = v_desconto_cupom,
    total = v_total_final
  WHERE id = v_resultado.pedido_id;


  ----------------------------------------------------
  -- 16. Consome o cupom
  ----------------------------------------------------

  UPDATE public.cupons
  SET
    ativo = false,
    usado_em = NOW(),
    pedido_id_usado = v_resultado.pedido_id
  WHERE id = v_cupom.id;


  ----------------------------------------------------
  -- 17. Retorna pedido já com desconto
  ----------------------------------------------------

  RETURN QUERY
  SELECT
    v_resultado.pedido_id,
    v_resultado.codigo_acesso,
    v_subtotal,
    v_taxa_entrega,
    v_total_final;

END;
$function$;


-- =========================================================
-- 2. CAMADA DE IDEMPOTÊNCIA
-- =========================================================

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
  p_itens jsonb,
  p_pontos_fidelidade integer,
  p_codigo_cupom text,
  p_chave_idempotencia uuid
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
DECLARE
  v_pedido_existente record;
  v_resultado record;
BEGIN

  ----------------------------------------------------
  -- 1. Valida chave
  ----------------------------------------------------

  IF p_chave_idempotencia IS NULL THEN

    RAISE EXCEPTION
      'CHAVE_IDEMPOTENCIA_INVALIDA';

  END IF;


  ----------------------------------------------------
  -- 2. Trava a chave desta tentativa
  ----------------------------------------------------

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_chave_idempotencia::text,
      0
    )
  );


  ----------------------------------------------------
  -- 3. Verifica se pedido já existe
  ----------------------------------------------------

  SELECT
    p.id,
    p.codigo_acesso,
    p.subtotal,
    p.taxa_entrega,
    p.total
  INTO v_pedido_existente
  FROM public.pedidos p
  WHERE p.chave_idempotencia =
    p_chave_idempotencia
  LIMIT 1;


  IF FOUND THEN

    RETURN QUERY
    SELECT
      v_pedido_existente.id,
      v_pedido_existente.codigo_acesso,
      v_pedido_existente.subtotal,
      v_pedido_existente.taxa_entrega,
      v_pedido_existente.total;

    RETURN;

  END IF;


  ----------------------------------------------------
  -- 4. Cria pedido com benefício
  ----------------------------------------------------

  SELECT *
  INTO v_resultado
  FROM public.criar_pedido_com_estoque(
    p_nome,
    p_telefone,
    p_cep,
    p_rua,
    p_numero,
    p_complemento,
    p_bairro,
    p_referencia,
    p_forma_pagamento,
    p_troco_para,
    p_itens,
    p_pontos_fidelidade,
    p_codigo_cupom
  );


  ----------------------------------------------------
  -- 5. Vincula a chave
  ----------------------------------------------------

  UPDATE public.pedidos
  SET chave_idempotencia =
    p_chave_idempotencia
  WHERE id = v_resultado.pedido_id;


  ----------------------------------------------------
  -- 6. Retorna resultado
  ----------------------------------------------------

  RETURN QUERY
  SELECT
    v_resultado.pedido_id,
    v_resultado.codigo_acesso,
    v_resultado.subtotal,
    v_resultado.taxa_entrega,
    v_resultado.total;

END;
$function$;


-- =========================================================
-- 3. PERMISSÕES
-- =========================================================

REVOKE ALL
ON FUNCTION public.criar_pedido_com_estoque(
  text, text, text, text, text,
  text, text, text, text, numeric,
  jsonb, integer, text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.criar_pedido_com_estoque(
  text, text, text, text, text,
  text, text, text, text, numeric,
  jsonb, integer, text
)
TO service_role;


REVOKE ALL
ON FUNCTION public.criar_pedido_com_estoque(
  text, text, text, text, text,
  text, text, text, text, numeric,
  jsonb, integer, text, uuid
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.criar_pedido_com_estoque(
  text, text, text, text, text,
  text, text, text, text, numeric,
  jsonb, integer, text, uuid
)
TO service_role;