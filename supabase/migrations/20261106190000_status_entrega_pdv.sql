BEGIN;

CREATE OR REPLACE FUNCTION public.pdv_entrega_alterar_status(
  p_venda_id bigint,
  p_status text,
  p_operador_email text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_venda record;
  v_atual text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'NAO_AUTORIZADO';
  END IF;

  IF p_venda_id IS NULL OR p_venda_id <= 0 OR
     nullif(btrim(p_operador_email),'') IS NULL THEN
    RAISE EXCEPTION 'DADOS_INVALIDOS';
  END IF;

  SELECT v.status, v.tipo_atendimento, v.dados_entrega
    INTO v_venda
  FROM public.pdv_vendas v
  WHERE v.id = p_venda_id
  FOR UPDATE;

  IF NOT FOUND OR v_venda.status <> 'concluida'
     OR v_venda.tipo_atendimento <> 'delivery' THEN
    RAISE EXCEPTION 'VENDA_NAO_EDITAVEL';
  END IF;

  v_atual := coalesce(
    v_venda.dados_entrega->>'status_entrega', 'recebido'
  );

  IF NOT (
    (v_atual='recebido' AND
      p_status IN ('em_preparacao','saiu_entrega','entregue'))
    OR
    (v_atual='em_preparacao' AND
      p_status IN ('saiu_entrega','entregue'))
    OR
    (v_atual='saiu_entrega' AND p_status='entregue')
  ) THEN
    RAISE EXCEPTION 'TRANSICAO_INVALIDA';
  END IF;

  UPDATE public.pdv_vendas
  SET dados_entrega = jsonb_set(
    dados_entrega, '{status_entrega}', to_jsonb(p_status), true
  )
  WHERE id=p_venda_id;
END;
$fn$;

REVOKE ALL ON FUNCTION
  public.pdv_entrega_alterar_status(bigint,text,text)
  FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION
  public.pdv_entrega_alterar_status(bigint,text,text)
  TO service_role;

COMMIT;