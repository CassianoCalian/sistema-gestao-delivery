BEGIN;

-- ============================================================
-- RATE LIMIT - CONSULTA DE FIDELIDADE
-- ============================================================
-- Protege a consulta pública de saldo contra enumeração
-- de números de telefone.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fidelidade_consultas_rate_limit (
  chave text PRIMARY KEY,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  contagem integer NOT NULL DEFAULT 1,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fidelidade_consultas_rate_limit
ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- FUNÇÃO ATÔMICA DE RATE LIMIT
-- ============================================================

CREATE OR REPLACE FUNCTION public.verificar_limite_consulta_fidelidade(
  p_chave text,
  p_limite integer,
  p_janela_segundos integer
)
RETURNS TABLE(
  permitido boolean,
  total_tentativas integer,
  tentar_novamente_em integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agora timestamptz := now();
  v_janela_inicio timestamptz;
  v_contagem integer;
  v_expira_em timestamptz;
BEGIN

  IF p_chave IS NULL
     OR btrim(p_chave) = '' THEN
    RAISE EXCEPTION 'CHAVE_RATE_LIMIT_INVALIDA';
  END IF;


  IF p_limite IS NULL
     OR p_limite <= 0 THEN
    RAISE EXCEPTION 'LIMITE_RATE_LIMIT_INVALIDO';
  END IF;


  IF p_janela_segundos IS NULL
     OR p_janela_segundos <= 0 THEN
    RAISE EXCEPTION 'JANELA_RATE_LIMIT_INVALIDA';
  END IF;


  INSERT INTO public.fidelidade_consultas_rate_limit AS rl (
    chave,
    janela_inicio,
    contagem,
    atualizado_em
  )
  VALUES (
    p_chave,
    v_agora,
    1,
    v_agora
  )

  ON CONFLICT (chave)
  DO UPDATE
  SET
    janela_inicio =
      CASE
        WHEN rl.janela_inicio <=
          v_agora - make_interval(secs => p_janela_segundos)
        THEN v_agora
        ELSE rl.janela_inicio
      END,

    contagem =
      CASE
        WHEN rl.janela_inicio <=
          v_agora - make_interval(secs => p_janela_segundos)
        THEN 1
        ELSE rl.contagem + 1
      END,

    atualizado_em = v_agora

  RETURNING
    rl.janela_inicio,
    rl.contagem

  INTO
    v_janela_inicio,
    v_contagem;


  v_expira_em :=
    v_janela_inicio
    + make_interval(secs => p_janela_segundos);


  RETURN QUERY
  SELECT
    v_contagem <= p_limite,

    v_contagem,

    GREATEST(
      0,
      CEIL(
        EXTRACT(
          EPOCH FROM (v_expira_em - v_agora)
        )
      )::integer
    );

END;
$function$;


-- ============================================================
-- SEGURANÇA
-- ============================================================
-- Cliente nunca acessa diretamente esta tabela/função.
-- Apenas o backend com service_role.
-- ============================================================

REVOKE ALL
ON TABLE public.fidelidade_consultas_rate_limit
FROM PUBLIC;

REVOKE ALL
ON TABLE public.fidelidade_consultas_rate_limit
FROM anon, authenticated;


REVOKE ALL
ON FUNCTION public.verificar_limite_consulta_fidelidade(
  text,
  integer,
  integer
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.verificar_limite_consulta_fidelidade(
  text,
  integer,
  integer
)
FROM anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.verificar_limite_consulta_fidelidade(
  text,
  integer,
  integer
)
TO service_role;


COMMIT;