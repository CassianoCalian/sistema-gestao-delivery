BEGIN;

CREATE OR REPLACE FUNCTION public.cadastrar_produto_admin(
  p_codigo_barras text,
  p_categoria_id bigint,
  p_nome text,
  p_descricao text,
  p_preco numeric,
  p_preco_promocional numeric,
  p_estoque_inicial integer,
  p_estoque_minimo integer,
  p_imagem_url text,
  p_ativo boolean,
  p_em_promocao boolean,
  p_permite_abaixo_minimo boolean
)
RETURNS TABLE(
  id bigint,
  codigo_barras text,
  categoria_id bigint,
  nome text,
  descricao text,
  preco numeric,
  preco_promocional numeric,
  estoque integer,
  estoque_minimo integer,
  imagem_url text,
  ativo boolean,
  em_promocao boolean,
  permite_abaixo_minimo boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_produto_id bigint;
BEGIN

  IF p_estoque_inicial IS NULL OR p_estoque_inicial < 0 THEN
    RAISE EXCEPTION 'ESTOQUE_INVALIDO';
  END IF;

  IF p_estoque_minimo IS NULL OR p_estoque_minimo < 0 THEN
    RAISE EXCEPTION 'ESTOQUE_MINIMO_INVALIDO';
  END IF;

  INSERT INTO produtos (
    codigo_barras,
    categoria_id,
    nome,
    descricao,
    preco,
    preco_promocional,
    estoque,
    estoque_minimo,
    imagem_url,
    ativo,
    em_promocao,
    permite_abaixo_minimo
  )
  VALUES (
    NULLIF(TRIM(p_codigo_barras), ''),
    p_categoria_id,
    TRIM(p_nome),
    NULLIF(TRIM(p_descricao), ''),
    p_preco,
    p_preco_promocional,
    0,
    p_estoque_minimo,
    NULLIF(TRIM(p_imagem_url), ''),
    COALESCE(p_ativo, true),
    COALESCE(p_em_promocao, false),
    COALESCE(p_permite_abaixo_minimo, false)
  )
  RETURNING produtos.id
  INTO v_produto_id;

  IF p_estoque_inicial > 0 THEN
    PERFORM *
    FROM public.registrar_entrada_estoque(
      v_produto_id,
      p_estoque_inicial,
      'Estoque inicial do cadastro do produto'
    );
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.codigo_barras,
    p.categoria_id,
    p.nome,
    p.descricao,
    p.preco,
    p.preco_promocional,
    p.estoque,
    p.estoque_minimo,
    p.imagem_url,
    p.ativo,
    p.em_promocao,
    p.permite_abaixo_minimo
  FROM produtos p
  WHERE p.id = v_produto_id;

END;
$function$;

COMMIT;