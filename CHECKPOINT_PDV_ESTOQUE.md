# DEPOSITO DO ZE - CHECKPOINT 15/10/2026

## PDV
- Build Next.js aprovado.
- Vendas integradas aos turnos de caixa.
- Turno #1 aberto no ultimo teste.
- Venda #1: R$ 76,00 via Pix, vinculada ao turno #1.
- Tres produtos com baixas de estoque verificadas.
- Controle financeiro exibe Pix, dinheiro, debito, credito,
  sangrias, suprimentos e dinheiro esperado.

## BANCO
- Migracao de vendas PDV executada.
- Migracao dos turnos executada.
- Migracao de integracao financeira executada no Supabase.
- PENDENCIA: verificar se a migracao 03 esta salva
  tambem no repositorio local.
- Backup SQL realizado e verificado basicamente.
- Nao enviar arquivos de backup do banco ao GitHub.

## ESTOQUE - DECISOES CONFIRMADAS
- Gelados e quentes usam o mesmo estoque fisico.
- Unidades, caixas, packs e promocoes devem consumir
  um saldo fisico compartilhado por familia.
- Nao somar saldos independentes automaticamente.
- Chopinho Antarctica: 438 unidades fisicas ao todo,
  incluindo as caixas fechadas.
- Chopinho Antarctica:
  ID 34 = unidade x1
  ID 28 = promocao x4
  ID 53 = caixa x23
  ID 96 = caixa quente inativa, revisar.
- Brahma Latao ja compartilha estoque fisico:
  grupo 1 com 240 unidades no levantamento.
  ID 8 = x1; ID 47 = x12; ID 25 = x5.

## EXATAMENTE ONDE RETOMAR
A ultima resposta do ChatGPT trouxe uma consulta SQL
SOMENTE LEITURA, com CTE "plano", para auditar
aproximadamente 50 associacoes candidatas de estoque.

PROXIMO PASSO AMANHA:
1. Executar aquela ULTIMA consulta no SQL Editor do Supabase,
   caso ainda nao tenha sido executada.
2. Enviar o resultado completo ao ChatGPT.
3. Separar grupos prontos e grupos pendentes de confirmacao.
4. Preparar migracao em lote SEM alterar saldos automaticamente.

Nenhuma migracao nova de estoque foi aplicada.
