CREATE OR REPLACE FUNCTION public.registrar_venda_pdv_no_caixa_ajustado(
 p_chave_idempotencia uuid,
 p_cliente_id bigint,
 p_forma_pagamento text,
 p_troco_para numeric,
 p_total_esperado numeric,
 p_itens jsonb,
 p_operador_uid uuid,
 p_operador_email text,
 p_caixa_codigo text,
 p_taxa_cartao numeric
)
RETURNS TABLE(
 id_venda bigint,
 valor_subtotal numeric,
 valor_taxa_cartao numeric,
 valor_total numeric,
 id_turno bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
 v_original record;
 v_existente record;
 v_subtotal numeric;
 v_total numeric;
 v_gravado numeric;
 v_base numeric;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
   RAISE EXCEPTION 'AJUSTE_NAO_AUTORIZADO';
 END IF;

 IF p_chave_idempotencia IS NULL OR p_itens IS NULL
    OR jsonb_typeof(p_itens) <> 'array'
    OR jsonb_array_length(p_itens) NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'CARRINHO_INVALIDO';
 END IF;

 IF p_taxa_cartao IS NULL
    OR p_taxa_cartao NOT BETWEEN 0 AND 999.99
    OR p_taxa_cartao <> round(p_taxa_cartao,2) THEN
   RAISE EXCEPTION 'TAXA_INVALIDA';
 END IF;

 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_itens) x(item)
   WHERE x.item ? 'preco_unitario_ajustado'
     AND (
       jsonb_typeof(x.item->'preco_unitario_ajustado') IS DISTINCT FROM 'number'
       OR CASE
         WHEN jsonb_typeof(x.item->'preco_unitario_ajustado') = 'number'
         THEN
           (x.item->>'preco_unitario_ajustado')::numeric
             NOT BETWEEN 0 AND 99999.99
           OR (x.item->>'preco_unitario_ajustado')::numeric <>
              round((x.item->>'preco_unitario_ajustado')::numeric,2)
         ELSE true
       END
     )
 ) THEN
   RAISE EXCEPTION 'PRECO_AJUSTADO_INVALIDO';
 END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(
     'pdv:' || p_chave_idempotencia::text,0
   )
 );

 SELECT v.id,v.subtotal,v.taxa_cartao,v.total,v.turno_id
 INTO v_existente
 FROM public.pdv_vendas v
 WHERE v.chave_idempotencia=p_chave_idempotencia;

 IF FOUND THEN
   IF v_existente.total IS DISTINCT FROM p_total_esperado THEN
     RAISE EXCEPTION 'CHAVE_REUTILIZADA';
   END IF;

   RETURN QUERY SELECT
     v_existente.id,v_existente.subtotal,
     v_existente.taxa_cartao,v_existente.total,
     v_existente.turno_id;
   RETURN;
 END IF;

 SELECT round(coalesce(sum(
   (CASE
     WHEN p.em_promocao AND p.preco_promocional IS NOT NULL
     THEN p.preco_promocional ELSE p.preco
   END)*i.quantidade
 ),0),2)
 INTO v_base
 FROM public.produtos p
 JOIN jsonb_to_recordset(p_itens)
   AS i(id bigint,quantidade integer)
   ON i.id=p.id;

 SELECT * INTO v_original
 FROM public.registrar_venda_pdv_no_caixa(
   p_chave_idempotencia,p_cliente_id,
   p_forma_pagamento,NULL::numeric,v_base,
   p_itens,p_operador_uid,p_operador_email,
   p_caixa_codigo
 );

 IF v_original.id_venda IS NULL THEN
   RAISE EXCEPTION 'VENDA_NAO_CONFIRMADA';
 END IF;

 UPDATE public.pdv_venda_itens vi
 SET
   preco_unitario=coalesce(
     i.preco_unitario_ajustado,vi.preco_unitario
   ),
   subtotal=round(
     coalesce(i.preco_unitario_ajustado,vi.preco_unitario)
     *vi.quantidade,2
   )
 FROM jsonb_to_recordset(p_itens)
   AS i(
     id bigint,
     quantidade integer,
     preco_unitario_ajustado numeric
   )
 WHERE vi.venda_id=v_original.id_venda
   AND vi.produto_id=i.id;

 SELECT coalesce(sum(vi.subtotal),0)
 INTO v_subtotal
 FROM public.pdv_venda_itens vi
 WHERE vi.venda_id=v_original.id_venda;

 v_total=round(v_subtotal+p_taxa_cartao,2);

 IF p_total_esperado IS NULL
    OR v_total <> p_total_esperado THEN
   RAISE EXCEPTION 'TOTAL_ALTERADO';
 END IF;

 IF p_forma_pagamento='dinheiro'
    AND p_troco_para IS NOT NULL
    AND p_troco_para<v_total THEN
   RAISE EXCEPTION 'TROCO_INVALIDO';
 END IF;

 UPDATE public.pdv_vendas v
 SET subtotal=v_subtotal,
     taxa_cartao=p_taxa_cartao,
     total=v_total,
     troco_para=CASE
       WHEN p_forma_pagamento='dinheiro'
       THEN p_troco_para ELSE NULL END
 WHERE v.id=v_original.id_venda
 RETURNING v.total INTO v_gravado;

 IF v_gravado IS DISTINCT FROM v_total THEN
   RAISE EXCEPTION 'TOTAL_GRAVADO_DIVERGENTE';
 END IF;

 RETURN QUERY SELECT
   v_original.id_venda,v_subtotal,p_taxa_cartao,
   v_total,v_original.id_turno;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.criar_pedido_pdv_entrega_ajustado(
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
 p_chave_idempotencia uuid,
 p_taxa_entrega numeric,
 p_taxa_cartao numeric,
 p_total_esperado numeric
)
RETURNS TABLE(
 pedido_id bigint,
 codigo_acesso uuid,
 subtotal numeric,
 taxa_entrega numeric,
 total numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
 v_pedido record;
 v_existente record;
 v_subtotal numeric;
 v_total numeric;
 v_gravado numeric;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
   RAISE EXCEPTION 'AJUSTE_NAO_AUTORIZADO';
 END IF;

 IF p_chave_idempotencia IS NULL OR p_itens IS NULL
    OR jsonb_typeof(p_itens)<>'array'
    OR jsonb_array_length(p_itens) NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'CARRINHO_INVALIDO';
 END IF;

 IF p_taxa_entrega IS NULL
    OR p_taxa_entrega NOT BETWEEN 0 AND 999.99
    OR p_taxa_entrega<>round(p_taxa_entrega,2)
    OR p_taxa_cartao IS NULL
    OR p_taxa_cartao NOT BETWEEN 0 AND 999.99
    OR p_taxa_cartao<>round(p_taxa_cartao,2) THEN
   RAISE EXCEPTION 'TAXA_INVALIDA';
 END IF;

 IF p_taxa_cartao>0
    AND p_forma_pagamento<>'cartao_entrega' THEN
   RAISE EXCEPTION 'TAXA_CARTAO_APENAS_CARTAO';
 END IF;

 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_itens) x(item)
   WHERE x.item ? 'preco_unitario_ajustado'
     AND (
       jsonb_typeof(x.item->'preco_unitario_ajustado') IS DISTINCT FROM 'number'
       OR CASE
         WHEN jsonb_typeof(x.item->'preco_unitario_ajustado')='number'
         THEN
           (x.item->>'preco_unitario_ajustado')::numeric
             NOT BETWEEN 0 AND 99999.99
           OR (x.item->>'preco_unitario_ajustado')::numeric <>
              round((x.item->>'preco_unitario_ajustado')::numeric,2)
         ELSE true
       END
     )
 ) THEN
   RAISE EXCEPTION 'PRECO_AJUSTADO_INVALIDO';
 END IF;

 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(
     p_chave_idempotencia::text,0
   )
 );

 SELECT p.id,p.codigo_acesso,p.subtotal,p.taxa_entrega,p.total
 INTO v_existente
 FROM public.pedidos p
 WHERE p.chave_idempotencia=p_chave_idempotencia;

 IF FOUND THEN
   IF v_existente.total IS DISTINCT FROM p_total_esperado THEN
     RAISE EXCEPTION 'CHAVE_REUTILIZADA';
   END IF;

   RETURN QUERY SELECT
     v_existente.id,v_existente.codigo_acesso,
     v_existente.subtotal,v_existente.taxa_entrega,
     v_existente.total;
   RETURN;
 END IF;

 SELECT * INTO v_pedido
 FROM public.criar_pedido_pdv_entrega(
   p_nome,p_telefone,p_cep,p_rua,p_numero,
   p_complemento,p_bairro,p_referencia,
   p_forma_pagamento,NULL::numeric,
   p_itens,p_chave_idempotencia
 );

 IF v_pedido.pedido_id IS NULL THEN
   RAISE EXCEPTION 'PEDIDO_NAO_CRIADO';
 END IF;

 UPDATE public.itens_pedido ip
 SET
   preco_unitario=coalesce(
     i.preco_unitario_ajustado,ip.preco_unitario
   ),
   subtotal=round(
     coalesce(i.preco_unitario_ajustado,ip.preco_unitario)
     *ip.quantidade,2
   )
 FROM jsonb_to_recordset(p_itens)
   AS i(
     id bigint,
     quantidade integer,
     preco_unitario_ajustado numeric
   )
 WHERE ip.pedido_id=v_pedido.pedido_id
   AND ip.produto_id=i.id;

 SELECT coalesce(sum(ip.subtotal),0)
 INTO v_subtotal
 FROM public.itens_pedido ip
 WHERE ip.pedido_id=v_pedido.pedido_id;

 v_total=round(
   v_subtotal+p_taxa_entrega+p_taxa_cartao,2
 );

 IF p_total_esperado IS NULL
    OR v_total<>p_total_esperado THEN
   RAISE EXCEPTION 'TOTAL_ALTERADO';
 END IF;

 IF p_forma_pagamento='dinheiro'
    AND p_troco_para IS NOT NULL
    AND p_troco_para<v_total THEN
   RAISE EXCEPTION 'TROCO_INVALIDO';
 END IF;

 UPDATE public.pedidos p
 SET subtotal=v_subtotal,
     taxa_entrega=p_taxa_entrega,
     taxa_cartao=p_taxa_cartao,
     total=v_total,
     troco_para=CASE
       WHEN p_forma_pagamento='dinheiro'
       THEN p_troco_para ELSE NULL END
 WHERE p.id=v_pedido.pedido_id
 RETURNING p.total INTO v_gravado;

 IF v_gravado IS DISTINCT FROM v_total THEN
   RAISE EXCEPTION 'TOTAL_GRAVADO_DIVERGENTE';
 END IF;

 RETURN QUERY SELECT
   v_pedido.pedido_id,v_pedido.codigo_acesso,
   v_subtotal,p_taxa_entrega,v_total;
END;
$fn$;

REVOKE ALL ON FUNCTION public.registrar_venda_pdv_no_caixa_ajustado(
 uuid,bigint,text,numeric,numeric,jsonb,uuid,text,text,numeric
) FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.criar_pedido_pdv_entrega_ajustado(
 text,text,text,text,text,text,text,text,text,
 numeric,jsonb,uuid,numeric,numeric,numeric
) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.registrar_venda_pdv_no_caixa_ajustado(
 uuid,bigint,text,numeric,numeric,jsonb,uuid,text,text,numeric
) TO service_role;

GRANT EXECUTE ON FUNCTION public.criar_pedido_pdv_entrega_ajustado(
 text,text,text,text,text,text,text,text,text,
 numeric,jsonb,uuid,numeric,numeric,numeric
) TO service_role;