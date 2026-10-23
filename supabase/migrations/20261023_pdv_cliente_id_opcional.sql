BEGIN;

-- Verificar se a protecao de fidelidade ja existe.
-- Se nao existir, interromper sem alterar a tabela.

DO $verificacao$
DECLARE
  v_funcao text;
BEGIN
  IF to_regprocedure(
    'public.processar_fidelidade_pedido_entregue()'
  ) IS NULL THEN
    RAISE EXCEPTION 'Funcao de fidelidade nao encontrada.';
  END IF;

  v_funcao := pg_get_functiondef(
    'public.processar_fidelidade_pedido_entregue()'::regprocedure
  );

  IF position(
    'PDV_ANONIMO_SEM_FIDELIDADE' in v_funcao
  ) = 0 THEN
    RAISE EXCEPTION
      'Protecao de fidelidade ausente. Alteracao cancelada.';
  END IF;

  IF to_regprocedure(
    'public.criar_pedido_pdv_entrega(text,text,text,text,text,text,text,text,text,numeric,jsonb,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Funcao de entrega PDV nao encontrada.';
  END IF;
END;
$verificacao$;

-- Permitir pedidos sem cliente cadastrado.
-- Nao remove a chave estrangeira.
-- Nao altera pedidos existentes.

ALTER TABLE public.pedidos
ALTER COLUMN cliente_id DROP NOT NULL;

COMMIT;

-- Confirmar resultado.
SELECT
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pedidos'
  AND column_name = 'cliente_id';