-- =========================================================
-- DEPÓSITO DO ZÉ
-- CANCELAMENTO RESTAURA CUPOM UTILIZADO
-- 2026-09-14
-- =========================================================

CREATE OR REPLACE FUNCTION public.cancelar_pedido_repor_estoque(
  p_pedido_id bigint
)
RETURNS TABLE(
  id bigint,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;

  v_cliente_id bigint;

  v_pontos_fidelidade_usados integer;
  v_desconto_fidelidade numeric(12, 2);

  v_cupom_id uuid;
BEGIN

  ----------------------------------------------------
  -- 1. Bloqueia o pedido
  ----------------------------------------------------

  SELECT
    p.status,
    p.cliente_id,
    COALESCE(p.pontos_fidelidade_usados, 0),
    COALESCE(p.desconto_fidelidade, 0),
    p.cupom_id

  INTO
    v_status,
    v_cliente_id,
    v_pontos_fidelidade_usados,
    v_desconto_fidelidade,
    v_cupom_id

  FROM public.pedidos AS p

  WHERE p.id = p_pedido_id

  FOR UPDATE;


  IF NOT FOUND THEN
    RAISE EXCEPTION 'PEDIDO_NAO_ENCONTRADO';
  END IF;


  ----------------------------------------------------
  -- 2. Cancelamento idempotente
  ----------------------------------------------------

  IF v_status = 'cancelado' THEN

    RETURN QUERY
    SELECT
      p.id,
      p.status
    FROM public.pedidos AS p
    WHERE p.id = p_pedido_id;

    RETURN;

  END IF;


  ----------------------------------------------------
  -- 3. Entregue não pode ser cancelado
  ----------------------------------------------------

  IF v_status = 'entregue' THEN

    RAISE EXCEPTION
      'PEDIDO_ENTREGUE_NAO_PODE_SER_CANCELADO';

  END IF;


  ----------------------------------------------------
  -- 4. Devolve pontos utilizados
  ----------------------------------------------------

  IF v_pontos_fidelidade_usados > 0 THEN

    UPDATE public.clientes AS c

    SET pontos_saldo =
      c.pontos_saldo
      + v_pontos_fidelidade_usados

    WHERE c.id = v_cliente_id;


    IF NOT FOUND THEN

      RAISE EXCEPTION
        'CLIENTE_NAO_ENCONTRADO:%',
        v_cliente_id;

    END IF;


    INSERT INTO public.fidelidade_movimentacoes (
      cliente_id,
      pedido_id,
      tipo,
      pontos,
      valor_referencia,
      observacao
    )
    VALUES (
      v_cliente_id,
      p_pedido_id,
      'ajuste_credito',
      v_pontos_fidelidade_usados,
      v_desconto_fidelidade,
      'Estorno de fidelidade por cancelamento do pedido #'
        || p_pedido_id
    );

  END IF;


  ----------------------------------------------------
  -- 5. Libera cupom utilizado
  --
  -- Mantemos cupom_id/codigo/desconto no pedido
  -- cancelado para auditoria.
  --
  -- O cupom volta a ficar ativo somente se ainda
  -- estiver dentro da validade original.
  ----------------------------------------------------

  IF v_cupom_id IS NOT NULL THEN

    UPDATE public.cupons AS c

    SET
      ativo = (c.valido_ate > NOW()),
      usado_em = NULL,
      pedido_id_usado = NULL

    WHERE c.id = v_cupom_id
      AND c.pedido_id_usado = p_pedido_id;

  END IF;


  ----------------------------------------------------
  -- 6. Registra devolução no histórico de estoque
  ----------------------------------------------------

  INSERT INTO public.movimentacoes_estoque (
    produto_id,
    pedido_id,
    tipo,
    quantidade,
    estoque_anterior,
    estoque_novo,
    observacao
  )
  SELECT
    p.id,
    p_pedido_id,
    'cancelamento',
    itens.quantidade_total,
    p.estoque,
    p.estoque + itens.quantidade_total,
    'Cancelamento do pedido #'
      || p_pedido_id

  FROM public.produtos AS p

  JOIN (
    SELECT
      ip.produto_id,
      SUM(ip.quantidade)::integer AS quantidade_total

    FROM public.itens_pedido AS ip

    WHERE ip.pedido_id = p_pedido_id

    GROUP BY ip.produto_id
  ) AS itens
    ON itens.produto_id = p.id;


  ----------------------------------------------------
  -- 7. Devolve estoque
  ----------------------------------------------------

  UPDATE public.produtos AS p

  SET estoque =
    p.estoque + itens.quantidade_total

  FROM (
    SELECT
      ip.produto_id,
      SUM(ip.quantidade)::integer AS quantidade_total

    FROM public.itens_pedido AS ip

    WHERE ip.pedido_id = p_pedido_id

    GROUP BY ip.produto_id
  ) AS itens

  WHERE p.id = itens.produto_id;


  ----------------------------------------------------
  -- 8. Marca como cancelado
  ----------------------------------------------------

  UPDATE public.pedidos AS p

  SET status = 'cancelado'

  WHERE p.id = p_pedido_id;


  ----------------------------------------------------
  -- 9. Retorna
  ----------------------------------------------------

  RETURN QUERY
  SELECT
    p.id,
    p.status

  FROM public.pedidos AS p

  WHERE p.id = p_pedido_id;

END;
$function$;