BEGIN;

DO $migracao$
DECLARE
  alvo regprocedure;
  codigo text;
  padrao text :=
    'if[[:space:]]+v_subtotal[[:space:]]*<[[:space:]]*30[[:space:]]+and[[:space:]]+not[[:space:]]+v_permite_abaixo_minimo[[:space:]]+then';
BEGIN
  alvo := to_regprocedure(
    'public.criar_pedido_com_estoque(text,text,text,text,text,text,text,text,text,numeric,jsonb)'
  );

  IF alvo IS NULL THEN
    RAISE EXCEPTION 'Funcao principal de pedidos nao encontrada.';
  END IF;

  codigo := pg_get_functiondef(alvo);

  IF position('app.pdv_entrega_autorizado' in codigo) = 0 THEN
    IF codigo !~* padrao THEN
      RAISE EXCEPTION 'Regra SQL diferente da esperada. Nenhuma alteracao aplicada.';
    END IF;

    codigo := regexp_replace(
      codigo,
      padrao,
      'if v_subtotal < 30 and not v_permite_abaixo_minimo and coalesce(current_setting(''app.pdv_entrega_autorizado'', true), '''') <> ''1'' then',
      'i'
    );

    EXECUTE codigo;
  END IF;
END;
$migracao$;

CREATE OR REPLACE FUNCTION public.criar_pedido_pdv_entrega(
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
SET search_path = public
AS $funcao$
BEGIN
  IF nullif(trim(p_nome), '') IS NULL
     OR nullif(trim(p_telefone), '') IS NULL
     OR nullif(trim(p_rua), '') IS NULL
     OR nullif(trim(p_numero), '') IS NULL
     OR nullif(trim(p_bairro), '') IS NULL THEN
    RAISE EXCEPTION 'ENDERECO_OU_CLIENTE_INVALIDO';
  END IF;

  IF coalesce(p_cep, '') <> ''
     AND p_cep !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'CEP_INVALIDO';
  END IF;

  PERFORM set_config('app.pdv_entrega_autorizado', '1', true);

  RETURN QUERY
  SELECT *
  FROM public.criar_pedido_com_estoque_v2(
    p_nome, p_telefone, coalesce(p_cep, ''),
    p_rua, p_numero, p_complemento, p_bairro,
    p_referencia, p_forma_pagamento, p_troco_para,
    p_itens, 0, NULL::text, p_chave_idempotencia
  );
END;
$funcao$;

REVOKE ALL ON FUNCTION public.criar_pedido_pdv_entrega(
  text,text,text,text,text,text,text,text,text,numeric,jsonb,uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.criar_pedido_pdv_entrega(
  text,text,text,text,text,text,text,text,text,numeric,jsonb,uuid
) TO service_role;

COMMIT;