CREATE OR REPLACE FUNCTION public.registrar_entrada_estoque(
  p_produto_id bigint,
  p_quantidade integer,
  p_observacao text DEFAULT NULL
)
RETURNS TABLE(
  produto_id bigint,
  estoque_anterior integer,
  estoque_novo integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_estoque_anterior integer;
  v_estoque_novo integer;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'QUANTIDADE_INVALIDA';
  END IF;

  SELECT p.estoque
  INTO v_estoque_anterior
  FROM produtos p
  WHERE p.id = p_produto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUTO_NAO_ENCONTRADO';
  END IF;

  v_estoque_novo := v_estoque_anterior + p_quantidade;

  INSERT INTO movimentacoes_estoque (
    produto_id,
    pedido_id,
    tipo,
    quantidade,
    estoque_anterior,
    estoque_novo,
    observacao
  )
  VALUES (
    p_produto_id,
    NULL,
    'entrada',
    p_quantidade,
    v_estoque_anterior,
    v_estoque_novo,
    COALESCE(
      NULLIF(TRIM(p_observacao), ''),
      'Entrada de mercadoria'
    )
  );

  UPDATE produtos p
  SET estoque = v_estoque_novo
  WHERE p.id = p_produto_id;

  RETURN QUERY
  SELECT
    p_produto_id,
    v_estoque_anterior,
    v_estoque_novo;
END;
$function$;