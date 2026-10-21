BEGIN;

ALTER TABLE public.pdv_venda_itens
ADD COLUMN IF NOT EXISTS opcoes_selecionadas jsonb
NOT NULL DEFAULT '[]'::jsonb;

COMMIT;

SELECT 'ESTRUTURA_PREPARADA' AS resultado;