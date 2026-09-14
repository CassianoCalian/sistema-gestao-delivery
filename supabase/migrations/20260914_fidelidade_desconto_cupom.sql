-- =========================================================
-- DEPÓSITO DO ZÉ
-- FIDELIDADE CONSIDERANDO DESCONTO DE CUPOM
-- 2026-09-14
-- =========================================================

CREATE OR REPLACE FUNCTION public.processar_fidelidade_pedido_entregue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_progresso_atual integer;
  v_valor_pedido_centavos integer;
  v_total_acumulado_centavos integer;

  v_pontos_gerados integer;
  v_novo_progresso integer;
BEGIN

  ----------------------------------------------------
  -- 1. Processa somente na primeira ida para entregue
  ----------------------------------------------------

  IF NEW.status <> 'entregue'
     OR OLD.status = 'entregue' THEN

    RETURN NEW;

  END IF;


  ----------------------------------------------------
  -- 2. Bloqueia cliente
  ----------------------------------------------------

  SELECT fidelidade_progresso_centavos
  INTO v_progresso_atual
  FROM public.clientes
  WHERE id = NEW.cliente_id
  FOR UPDATE;


  IF NOT FOUND THEN

    RAISE EXCEPTION
      'CLIENTE_NAO_ENCONTRADO:%',
      NEW.cliente_id;

  END IF;


  ----------------------------------------------------
  -- 3. Proteção contra crédito duplicado
  ----------------------------------------------------

  IF EXISTS (
    SELECT 1
    FROM public.fidelidade_movimentacoes
    WHERE pedido_id = NEW.id
      AND tipo = 'credito_pedido'
  ) THEN

    RETURN NEW;

  END IF;


  ----------------------------------------------------
  -- 4. Valor efetivamente pago pelos produtos
  --
  -- Não entram:
  -- taxa de entrega
  -- taxa de cartão
  --
  -- São descontados:
  -- fidelidade
  -- cupom
  ----------------------------------------------------

  v_valor_pedido_centavos :=
    ROUND(
      GREATEST(
        COALESCE(NEW.subtotal, 0)
        - COALESCE(NEW.desconto_fidelidade, 0)
        - COALESCE(NEW.desconto_cupom, 0),
        0
      ) * 100
    )::integer;


  ----------------------------------------------------
  -- 5. Soma ao progresso anterior
  ----------------------------------------------------

  v_total_acumulado_centavos :=
    v_progresso_atual
    + v_valor_pedido_centavos;


  ----------------------------------------------------
  -- 6. Cada R$ 5 pagos = 1 ponto
  ----------------------------------------------------

  v_pontos_gerados :=
    FLOOR(
      v_total_acumulado_centavos::numeric / 500
    )::integer;


  ----------------------------------------------------
  -- 7. Guarda os centavos restantes
  ----------------------------------------------------

  v_novo_progresso :=
    MOD(
      v_total_acumulado_centavos,
      500
    );


  ----------------------------------------------------
  -- 8. Atualiza cliente
  ----------------------------------------------------

  UPDATE public.clientes
  SET
    pontos_saldo =
      pontos_saldo + v_pontos_gerados,

    fidelidade_progresso_centavos =
      v_novo_progresso
  WHERE id = NEW.cliente_id;


  ----------------------------------------------------
  -- 9. Registra crédito no extrato
  ----------------------------------------------------

  INSERT INTO public.fidelidade_movimentacoes (
    cliente_id,
    pedido_id,
    tipo,
    pontos,
    valor_referencia,
    observacao
  )
  VALUES (
    NEW.cliente_id,
    NEW.id,
    'credito_pedido',
    v_pontos_gerados,

    GREATEST(
      COALESCE(NEW.subtotal, 0)
      - COALESCE(NEW.desconto_fidelidade, 0)
      - COALESCE(NEW.desconto_cupom, 0),
      0
    ),

    'Crédito de fidelidade do pedido #'
      || NEW.id
  );


  RETURN NEW;

END;
$function$;