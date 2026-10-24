type ItemPedido = {
  id: number;
  nome_produto: string;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
  opcoes_selecionadas?: unknown;
};

type PedidoImpressao = {
  id: number;
  status: string;
  created_at: string;
  nome_cliente: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  referencia: string | null;
  forma_pagamento: string;
  pagamento_confirmado: boolean;
  troco_para: number | null;
  subtotal: number;
  taxa_entrega: number;
  taxa_cartao: number | null;

  desconto_fidelidade?: number | null;
  pontos_fidelidade_usados?: number | null;
  codigo_cupom?: string | null;
  desconto_cupom?: number | null;
  total: number;

  pagamentos_detalhes?: {
    parcelas?: {
      forma: string;
      valor: number;
      recebido?: boolean;
    }[];
    pago?: boolean;
  } | null;
};

type PrintableOrderReceiptProps = {
  pedido: PedidoImpressao;
  itens: ItemPedido[];
};

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarPagamento(forma: string) {
  if (forma === "pix") return "PIX";

  if (forma === "cartao_entrega") return "Cartão na entrega";

  if (forma === "dinheiro") return "Dinheiro na entrega";

  return forma;
}

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));
}

function formatarTelefone(telefone: string) {
  const numeros = telefone.replace(/\D/g, "").replace(/^55/, "");

  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }

  return telefone;
}

export default function PrintableOrderReceipt({
  pedido,
  itens,
}: PrintableOrderReceiptProps) {
  const taxaCartao = Number(pedido.taxa_cartao ?? 0);
  const taxaEntrega = Number(pedido.taxa_entrega ?? 0);

  const valorParaTroco =
    pedido.troco_para == null ? null : Number(pedido.troco_para);

  const trocoCalculado =
    pedido.forma_pagamento === "dinheiro" &&
    valorParaTroco !== null &&
    Number.isFinite(valorParaTroco) &&
    valorParaTroco >= Number(pedido.total)
      ? (Math.round(valorParaTroco * 100) -
          Math.round(Number(pedido.total) * 100)) / 100
      : null;

  const descontoFidelidade = Number(pedido.desconto_fidelidade ?? 0);

  const pontosFidelidadeUsados = Number(pedido.pontos_fidelidade_usados ?? 0);
  const descontoCupom = Number(pedido.desconto_cupom ?? 0);

  const codigoCupom =
    typeof pedido.codigo_cupom === "string" ? pedido.codigo_cupom : "";

  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "21973209746";

  const parcelasDivididas =
    Array.isArray(pedido.pagamentos_detalhes?.parcelas) &&
    pedido.pagamentos_detalhes.parcelas.length > 1
      ? pedido.pagamentos_detalhes.parcelas
      : [];

  const valorRecebidoCentavos =
    parcelasDivididas.reduce(
      (soma, p) =>
        soma +
        (pedido.pagamento_confirmado || p.recebido === true
          ? Math.round(Number(p.valor) * 100)
          : 0),
      0
    );

  const saldoReceberCentavos = Math.max(
    0,
    Math.round(Number(pedido.total) * 100) -
      valorRecebidoCentavos
  );

  const statusPagamento =
    parcelasDivididas.length > 0
      ? pedido.pagamento_confirmado
        ? "PAGO - CONFIRMADO"
        : valorRecebidoCentavos > 0
          ? "PAGAMENTO PARCIAL"
          : "PAGAMENTO PENDENTE"
      : pedido.pagamento_confirmado
        ? pedido.forma_pagamento === "pix"
          ? "PIX PAGO - CONFIRMADO"
          : pedido.forma_pagamento === "cartao_entrega"
            ? "CARTAO PAGO - CONFIRMADO"
            : "DINHEIRO PAGO - CONFIRMADO"
        : pedido.forma_pagamento === "pix"
          ? "PIX PENDENTE"
          : pedido.forma_pagamento === "cartao_entrega"
            ? "CARTAO NA ENTREGA - PENDENTE"
            : "DINHEIRO NA ENTREGA - PENDENTE";

  return (
    <div id="comanda-deposito-ze" className="hidden print:block">
      <style>{`
        @media print {
          @page {
            margin: 0;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          #comanda-deposito-ze {
            display: block !important;
            box-sizing: border-box !important;
            width: 80mm !important;
            max-width: 80mm !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 2mm 4mm 5mm !important;
            background: white !important;
            color: black !important;
          }

          #comanda-deposito-ze .comanda-conteudo {
            box-sizing: border-box !important;
            width: 72mm !important;
            max-width: 72mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }

          #comanda-deposito-ze * {
            box-sizing: border-box !important;
            color: black !important;
          }

          #comanda-deposito-ze p,
          #comanda-deposito-ze span {
            overflow-wrap: anywhere !important;
          }
        }
      `}</style>

      <div className="comanda-conteudo mx-auto w-[72mm] bg-white font-mono text-[13px] leading-[16px] text-black">
        {/* CABEÇALHO */}
        <div className="border-b border-dashed border-black pb-1 text-center">
          <p className="text-lg font-black uppercase">Depósito do Zé</p>

          <p className="mt-0 text-[11px] font-black uppercase">
            Comanda de entrega
          </p>

          <p className="text-[10px] uppercase">Não é documento fiscal</p>

          {pedido.status === "cancelado" && (
            <p className="mt-1 border-2 border-black p-2 text-center text-base font-black uppercase">
              PEDIDO CANCELADO - NÃO ENTREGAR
            </p>
          )}

          <p className="mt-0">Av. Recife, 574 - Jardim Pernambuco</p>

          <p>Nova Iguaçu - RJ</p>

          <p className="mt-0 font-bold">
            WhatsApp: {formatarTelefone(whatsapp)}
          </p>

          <div className="mt-0 flex justify-between gap-2 font-black">
            <span>Comanda de entrega</span>
            <span className="text-[11px] font-normal">
              {formatarData(pedido.created_at)}
            </span>
          </div>
        </div>

        {/* STATUS DO PAGAMENTO */}
        <div className="border-b border-dashed border-black py-1 text-center">
          <p className="text-[11px] font-black uppercase">
            PAGAMENTO - {pedido.pagamento_confirmado
              ? "PAGO"
              : valorRecebidoCentavos > 0
                ? "PARCIAL"
                : "PENDENTE"}
          </p>

          <p className="mt-0 text-base font-black uppercase">
            {statusPagamento}
          </p>

          {parcelasDivididas.length > 0 && (
            <div className="mt-2 border-t border-dashed border-black pt-2 text-left">
              <p className="text-center text-[12px] font-black uppercase">
                Pagamento dividido
              </p>

              {parcelasDivididas.map((parcela, index) => (
                <div
                  key={index}
                  className="mt-1 flex justify-between gap-2 text-[12px]"
                >
                  <span className="font-bold uppercase">
                    {parcela.forma === "pix"
                      ? "PIX"
                      : parcela.forma === "dinheiro"
                        ? "DINHEIRO"
                        : parcela.forma === "debito"
                          ? "CARTAO DEBITO"
                          : "CARTAO CREDITO"}
                  </span>

                  <span className="font-bold">
                    {formatarPreco(Number(parcela.valor))}

                    <span className="block text-[10px]">
                      {pedido.pagamento_confirmado || parcela.recebido === true
                        ? "RECEBIDO"
                        : "A RECEBER"}
                    </span>
                  </span>
                </div>
              ))}

              <div className="mt-2 flex justify-between border-t border-dashed border-black pt-1 font-black">
                <span>TOTAL</span>
                <span>{formatarPreco(Number(pedido.total))}</span>
              </div>

              <p className="mt-1 text-center text-[11px] font-black">
                {pedido.pagamento_confirmado
                  ? "VALOR INTEGRAL RECEBIDO"
                  : `COBRAR NA ENTREGA: ${formatarPreco(saldoReceberCentavos / 100)}`}
              </p>
            </div>
          )}

          {parcelasDivididas.length === 0 && pedido.forma_pagamento === "pix" && !pedido.pagamento_confirmado && (
            <p className="mt-0 text-[11px] font-black uppercase">
              Aguardar confirmação antes de liberar
            </p>
          )}
          {parcelasDivididas.length === 0 &&
            pedido.forma_pagamento === "dinheiro" && (
              <p className="text-[12px] font-black uppercase">
                {pedido.troco_para != null && Number(pedido.troco_para) > 0
                  ? `TROCO PARA: ${formatarPreco(Number(pedido.troco_para))}`
                  : "SEM TROCO"}
              </p>
            )}
        </div>

        {/* TROCO CALCULADO */}
        {trocoCalculado !== null && trocoCalculado > 0 && (
          <div className="border-b border-dashed border-black py-2 text-center">
            <p className="text-[11px] font-black uppercase">
              TROCO A DEVOLVER
            </p>
            <p className="mt-1 text-xl font-black">
              {formatarPreco(trocoCalculado)}
            </p>
          </div>
        )}

        {/* CLIENTE */}
        <div className="border-b border-dashed border-black py-1">
          <p>
            <span className="font-black uppercase">Cliente: </span>
            {pedido.nome_cliente}
          </p>

          <p>{formatarTelefone(pedido.telefone)}</p>
        </div>

        {/* ENDEREÇO */}
        <div className="border-b border-dashed border-black py-1">
          <p>
            <span className="font-black uppercase">Entrega: </span>
            {pedido.rua}, {pedido.numero}
          </p>

          <p>{pedido.bairro}</p>

          <p>CEP: {pedido.cep}</p>

          {pedido.complemento && <p>Complemento: {pedido.complemento}</p>}

          {pedido.referencia && <p>Referência: {pedido.referencia}</p>}
        </div>

        {/* ITENS */}
        <div className="border-b border-dashed border-black py-1">
          <p className="mb-1 font-black uppercase">Itens</p>

          <div className="space-y-1">
            {itens.map((item) => (
              <div key={item.id}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words font-bold">
                    {item.quantidade}x {item.nome_produto}
                  </span>

                  <span className="shrink-0 font-bold">
                    {formatarPreco(Number(item.subtotal))}
                  </span>
                </div>

                <p className="text-[11px]">
                  {formatarPreco(Number(item.preco_unitario))} cada
                </p>
                {Array.isArray(item.opcoes_selecionadas) &&
                  item.opcoes_selecionadas.length > 0 && (
                    <div className="mt-0 pl-2 text-[11px]">
                      <p className="font-black uppercase">Sabores / opções</p>

                      {item.opcoes_selecionadas.map((opcao, index) => {
                        if (
                          typeof opcao !== "object" ||
                          opcao === null ||
                          Array.isArray(opcao)
                        ) {
                          return null;
                        }

                        const nome =
                          "nome" in opcao && typeof opcao.nome === "string"
                            ? opcao.nome
                            : "Opção";

                        const quantidade =
                          "quantidade" in opcao
                            ? Number(opcao.quantidade ?? 0)
                            : 0;

                        return (
                          <p key={`${nome}-${index}`}>
                            - {nome}: {quantidade}
                          </p>
                        );
                      })}
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>

        {/* VALORES */}
        <div className="border-b border-dashed border-black py-1">
          <div className="flex justify-between">
            <span>Subtotal</span>

            <span>{formatarPreco(Number(pedido.subtotal))}</span>
          </div>

          <div className="mt-0 flex justify-between">
            <span>Entrega</span>

            <span>
              {taxaEntrega === 0 ? "Grátis" : formatarPreco(taxaEntrega)}
            </span>
          </div>

          {taxaCartao > 0 && (
            <div className="mt-0 flex justify-between">
              <span>Taxa cartão</span>

              <span>{formatarPreco(taxaCartao)}</span>
            </div>
          )}

          {descontoFidelidade > 0 && (
            <>
              <div className="mt-0 flex justify-between font-bold">
                <span>Desconto fidelidade</span>
                <span>- {formatarPreco(descontoFidelidade)}</span>
              </div>

              {pontosFidelidadeUsados > 0 && (
                <div className="mt-0 flex justify-between text-[10px]">
                  <span>Pontos utilizados</span>
                  <span>{pontosFidelidadeUsados} pts</span>
                </div>
              )}
            </>
          )}

          {descontoCupom > 0 && codigoCupom && (
            <>
              <div className="mt-0 flex justify-between font-bold">
                <span>Desconto cupom</span>
                <span>- {formatarPreco(descontoCupom)}</span>
              </div>

              <div className="mt-0 flex justify-between gap-3 text-[10px]">
                <span>Cupom</span>
                <span className="break-all text-right font-bold">
                  {codigoCupom}
                </span>
              </div>
            </>
          )}

          <div className="mt-1 flex justify-between border-t border-dashed border-black pt-1 text-base font-black">
            <span>TOTAL</span>

            <span>{formatarPreco(Number(pedido.total))}</span>
          </div>
        </div>

        {/* CONFERÊNCIA */}
        <div className="py-1">
          <p className="font-black uppercase">Conferência</p>

          <p className="mt-1">Separado por: ___________________</p>

          <p className="mt-1">Entregador: ____________________</p>
        </div>

        <div className="border-t border-dashed border-black pt-1 text-center">
          <p className="font-black">*** FIM DO PEDIDO ***</p>
        </div>
      </div>
    </div>
  );
}
