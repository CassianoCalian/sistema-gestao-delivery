-- =========================================================
-- DIA 17
-- LIMPEZA AUTOMÁTICA DO RATE LIMIT DE FIDELIDADE
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pg_cron
WITH SCHEMA extensions;


-- =========================================================
-- FUNÇÃO DE LIMPEZA
-- =========================================================

CREATE OR REPLACE FUNCTION public.limpar_rate_limit_fidelidade()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_excluidos integer;
BEGIN
  DELETE FROM public.fidelidade_consultas_rate_limit
  WHERE atualizado_em < now() - interval '24 hours';

  GET DIAGNOSTICS v_excluidos = ROW_COUNT;

  RETURN v_excluidos;
END;
$$;


-- =========================================================
-- PERMISSÕES
-- =========================================================

REVOKE ALL
ON FUNCTION public.limpar_rate_limit_fidelidade()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.limpar_rate_limit_fidelidade()
FROM anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.limpar_rate_limit_fidelidade()
TO service_role;


-- =========================================================
-- AGENDAMENTO DIÁRIO
-- 06:20 UTC / 03:20 HORÁRIO DE BRASÍLIA
-- =========================================================

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'limpar-rate-limit-fidelidade'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'limpar-rate-limit-fidelidade',
    '20 6 * * *',
    $cron$
      SELECT public.limpar_rate_limit_fidelidade();
    $cron$
  );
END;
$$;