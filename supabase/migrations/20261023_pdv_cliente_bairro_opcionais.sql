BEGIN;

-- Permite pedidos sem cadastro apenas na API exclusiva do PDV.
-- Nao modifica a regra de pedido minimo do site.
-- Nao cria cliente ficticio quando nao ha telefone.

DO $ajuste$
DECLARE
  alvo regprocedure;
  codigo text;
  trecho text;
  padrao text;
BEGIN
  alvo := to_regprocedure(
    'public.criar_pedido_com_estoque(text,text,text,text,text,text,text,text,text,numeric,jsonb)'
  );

  IF alvo IS NULL THEN
    RAISE EXCEPTION 'Funcao principal nao encontrada';
  END IF;

  codigo := pg_get_functiondef(alvo);

  IF position('PDV_ANONIMO_SEM_CRM' in codigo) = 0 THEN
    padrao := '(?is)insert[[:space:]]+into[[:space:]]+(?:public[.])?clientes(?:[[:space:]]+as[[:space:]]+c)?[[:space:]]*\(.*?into[[:space:]]+v_cliente_id[[:space:]]*;';

    trecho := substring(codigo FROM padrao);

    IF trecho IS NULL THEN
      RAISE EXCEPTION 'Cadastro de cliente diferente do esperado. Migracao cancelada.';
    END IF;

    codigo := replace(
      codigo,
      trecho,
      'IF coalesce(current_setting(''app.pdv_entrega_autorizado'', true), '''') = ''1''
          AND coalesce(trim(p_telefone), '''') = '''' THEN
         -- PDV_ANONIMO_SEM_CRM
         v_cliente_id := NULL;
       ELSE
       ' || trecho || '
       END IF;'
    );

    EXECUTE codigo;
  END IF;

  -- Pedidos sem cliente nao devem receber pontos de fidelidade.
  alvo := to_regprocedure(
    'public.processar_fidelidade_pedido_entregue()'
  );

  IF alvo IS NULL THEN
    RAISE EXCEPTION 'Funcao de fidelidade nao encontrada';
  END IF;

  codigo := pg_get_functiondef(alvo);

  IF position('PDV_ANONIMO_SEM_FIDELIDADE' in codigo) = 0 THEN
    padrao := '(?is)select[[:space:]]+fidelidade_progresso_centavos';
    trecho := substring(codigo FROM padrao);

    IF trecho IS NULL THEN
      RAISE EXCEPTION 'Trigger de fidelidade diferente do esperado';
    END IF;

    codigo := replace(
      codigo,
      trecho,
      'IF NEW.cliente_id IS NULL THEN
         -- PDV_ANONIMO_SEM_FIDELIDADE
         RETURN NEW;
       END IF;
       ' || trecho
    );

    EXECUTE codigo;
  END IF;
END;
$ajuste$;

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
  IF nullif(trim(p_rua), '') IS NULL
     OR nullif(trim(p_numero), '') IS NULL THEN
    RAISE EXCEPTION 'RUA_E_NUMERO_OBRIGATORIOS';
  END IF;

  IF coalesce(p_cep, '') <> ''
     AND p_cep !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'CEP_INVALIDO';
  END IF;

  PERFORM set_config('app.pdv_entrega_autorizado', '1', true);

  RETURN QUERY
  SELECT *
  FROM public.criar_pedido_com_estoque_v2(
    coalesce(nullif(trim(p_nome), ''), 'Consumidor nao identificado'),
    coalesce(p_telefone, ''),
    coalesce(p_cep, ''),
    p_rua,
    p_numero,
    p_complemento,
    coalesce(p_bairro, ''),
    p_referencia,
    p_forma_pagamento,
    p_troco_para,
    p_itens,
    0,
    NULL::text,
    p_chave_idempotencia
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