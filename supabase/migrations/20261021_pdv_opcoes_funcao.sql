BEGIN;

DO $migracao$
DECLARE
  codigo text;
  inicio integer;
  fim integer;
  ancora text := '  -- Registra a movimentação no histórico dos produtos.';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pdv_venda_itens'
      AND column_name = 'opcoes_selecionadas'
      AND data_type = 'jsonb'
  ) THEN
    RAISE EXCEPTION 'COLUNA_DE_SABORES_NAO_ENCONTRADA';
  END IF;

  SELECT pg_get_functiondef(
    'public.registrar_venda_pdv(uuid,bigint,text,numeric,numeric,jsonb)'::regprocedure
  ) INTO STRICT codigo;

  -- Permite aplicar a migracao em um banco ja atualizado.
  IF position('PDV_OPCOES_V1' IN codigo) > 0 THEN
    RAISE NOTICE 'PDV_OPCOES_V1_JA_ATIVA';
    RETURN;
  END IF;

  inicio := position(
    '  -- Produtos com seleção de sabores não entram nesta'
    IN codigo
  );

  fim := position(
    '  -- Confere o estoque de produtos não compartilhados.'
    IN codigo
  );

  IF inicio = 0 OR fim <= inicio OR fim - inicio > 800 THEN
    RAISE EXCEPTION 'FUNCAO_PDV_DIFERENTE_DA_VERSAO_ESPERADA';
  END IF;

  IF position(
    'PRODUTO_COM_OPCOES'
    IN substring(codigo FROM inicio FOR fim - inicio)
  ) = 0 THEN
    RAISE EXCEPTION 'BLOQUEIO_ORIGINAL_NAO_LOCALIZADO';
  END IF;

  codigo := substring(codigo FROM 1 FOR inicio - 1)
  || $validacao$
  -- PDV_OPCOES_V1: valida os sabores antes de registrar a venda.
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_itens) AS i(
      id bigint,
      quantidade integer,
      opcoes_selecionadas jsonb
    )
    JOIN public.produtos p ON p.id = i.id
    LEFT JOIN LATERAL (
      SELECT
        count(*) AS total_linhas,
        count(po.id) AS opcoes_ativas,
        count(DISTINCT po.id) AS opcoes_distintas,
        count(*) FILTER (
          WHERE jsonb_typeof(o.valor) IS DISTINCT FROM 'object'
             OR jsonb_typeof(o.valor->'opcao_id')
                IS DISTINCT FROM 'number'
             OR coalesce(
                  (o.valor->>'opcao_id') ~ '^[1-9][0-9]{0,15}$',
                  false
                ) = false
             OR jsonb_typeof(o.valor->'quantidade')
                IS DISTINCT FROM 'number'
             OR coalesce(
                  (o.valor->>'quantidade') ~ '^[1-9][0-9]{0,3}$',
                  false
                ) = false
        ) AS invalidas,
        coalesce(sum(
          CASE
            WHEN coalesce(
              (o.valor->>'quantidade') ~ '^[1-9][0-9]{0,3}$',
              false
            )
            THEN (o.valor->>'quantidade')::integer
            ELSE 0
          END
        ), 0) AS total_unidades
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(i.opcoes_selecionadas) = 'array'
          THEN i.opcoes_selecionadas
          ELSE '[]'::jsonb
        END
      ) AS o(valor)
      LEFT JOIN public.produto_opcoes po
        ON po.id = CASE
          WHEN coalesce(
            (o.valor->>'opcao_id') ~ '^[1-9][0-9]{0,15}$',
            false
          )
          THEN (o.valor->>'opcao_id')::bigint
          ELSE NULL
        END
        AND po.produto_id = i.id
        AND po.ativo = true
    ) escolhas ON true
    WHERE (
      coalesce(p.unidades_por_item, 0) = 0
      AND coalesce(i.opcoes_selecionadas, '[]'::jsonb)
          <> '[]'::jsonb
    )
    OR (
      coalesce(p.unidades_por_item, 0) > 0
      AND (
        jsonb_typeof(i.opcoes_selecionadas)
          IS DISTINCT FROM 'array'
        OR escolhas.total_linhas NOT BETWEEN 1 AND 100
        OR escolhas.invalidas > 0
        OR escolhas.opcoes_ativas <> escolhas.total_linhas
        OR escolhas.opcoes_distintas <> escolhas.total_linhas
        OR escolhas.total_unidades <>
          p.unidades_por_item::bigint * i.quantidade::bigint
      )
    )
  ) THEN
    RAISE EXCEPTION 'OPCOES_INVALIDAS';
  END IF;

$validacao$
  || substring(codigo FROM fim);

  IF position(ancora IN codigo) = 0 OR
     position(
       ancora IN substring(
         codigo FROM position(ancora IN codigo) + length(ancora)
       )
     ) > 0 THEN
    RAISE EXCEPTION 'PONTO_DE_HISTORICO_NAO_LOCALIZADO';
  END IF;

  codigo := replace(
    codigo,
    ancora,
    $historico$
  -- Guarda os nomes e quantidades dos sabores vendidos.
  UPDATE public.pdv_venda_itens vi
  SET opcoes_selecionadas = coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'nome', po.nome,
        'quantidade', (o.valor->>'quantidade')::integer
      )
      ORDER BY po.ordem, po.id
    )
    FROM jsonb_to_recordset(p_itens) AS i(
      id bigint,
      quantidade integer,
      opcoes_selecionadas jsonb
    )
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(i.opcoes_selecionadas) = 'array'
        THEN i.opcoes_selecionadas
        ELSE '[]'::jsonb
      END
    ) AS o(valor)
    JOIN public.produto_opcoes po
      ON po.id = (o.valor->>'opcao_id')::bigint
      AND po.produto_id = i.id
    WHERE i.id = vi.produto_id
  ), '[]'::jsonb)
  WHERE vi.venda_id = v_venda_id;

$historico$ || ancora
  );

  EXECUTE codigo;
END;
$migracao$;

COMMIT;

SELECT CASE
  WHEN position(
    'PDV_OPCOES_V1'
    IN pg_get_functiondef(
      'public.registrar_venda_pdv(uuid,bigint,text,numeric,numeric,jsonb)'::regprocedure
    )
  ) > 0
  THEN 'PDV_OPCOES_V1_ATIVA'
  ELSE 'VERIFICAR_FUNCAO'
END AS resultado;