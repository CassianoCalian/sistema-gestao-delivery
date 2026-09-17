type ItemPedido = {
  id: number;
  nome_produto: string;
  preco_unitario: number;
  quantidade: number;
  subtotal: number;
};

type PedidoImpressao = {
  id: number;
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

  const descontoFidelidade = Number(pedido.desconto_fidelidade ?? 0);

  const pontosFidelidadeUsados = Number(pedido.pontos_fidelidade_usados ?? 0);
  const descontoCupom = Number(pedido.desconto_cupom ?? 0);

  const codigoCupom =
    typeof pedido.codigo_cupom === "string" ? pedido.codigo_cupom : "";

  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "21973209746";

  const statusPagamento =
    pedido.forma_pagamento === "pix"
      ? pedido.pagamento_confirmado
        ? "PIX PAGO ✓"
        : "PIX PENDENTE"
      : pedido.forma_pagamento === "cartao_entrega"
        ? "CARTÃO NA ENTREGA"
        : "DINHEIRO NA ENTREGA";

  return (
    <div className="hidden print:block">
      <div className="mx-auto w-[72mm] bg-white font-mono text-[13px] leading-5 text-black">
        {/* CABEÇALHO */}
        <div className="border-b border-dashed border-black pb-3 text-center">
          <p className="text-lg font-black uppercase">Depósito do Zé</p>

          <p className="mt-1">Av. Recife, 574 - Jardim Pernambuco</p>

          <p>Nova Iguaçu - RJ</p>

          <p className="mt-1 font-bold">
            WhatsApp: {formatarTelefone(whatsapp)}
          </p>

          <p className="mt-2 font-black">Pedido #{pedido.id}</p>

          <p className="mt-1 text-[11px]">{formatarData(pedido.created_at)}</p>
        </div>

        {/* STATUS DO PAGAMENTO */}
        <div className="border-b border-dashed border-black py-3 text-center">
          <p className="text-[11px] font-black uppercase">Pagamento</p>

          <p className="mt-1 text-base font-black uppercase">
            {statusPagamento}
          </p>

          {pedido.forma_pagamento === "pix" && !pedido.pagamento_confirmado && (
            <p className="mt-1 text-[11px] font-black uppercase">
              Aguardar confirmação antes de liberar
            </p>
          )}
        </div>

        {/* CLIENTE */}
        <div className="border-b border-dashed border-black py-3">
          <p className="font-black uppercase">Cliente</p>

          <p className="mt-1">{pedido.nome_cliente}</p>

          <p>{formatarTelefone(pedido.telefone)}</p>
        </div>

        {/* ENDEREÇO */}
        <div className="border-b border-dashed border-black py-3">
          <p className="font-black uppercase">Entrega</p>

          <p className="mt-1">
            {pedido.rua}, {pedido.numero}
          </p>

          <p>{pedido.bairro}</p>

          <p>CEP: {pedido.cep}</p>

          {pedido.complemento && <p>Complemento: {pedido.complemento}</p>}

          {pedido.referencia && <p>Referência: {pedido.referencia}</p>}
        </div>

        {/* ITENS */}
        <div className="border-b border-dashed border-black py-3">
          <p className="mb-2 font-black uppercase">Itens</p>

          <div className="space-y-2">
            {itens.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between gap-3">
                  <span className="font-bold">
                    {item.quantidade}x {item.nome_produto}
                  </span>

                  <span className="shrink-0 font-bold">
                    {formatarPreco(Number(item.subtotal))}
                  </span>
                </div>

                <p className="text-[11px]">
                  {formatarPreco(Number(item.preco_unitario))} cada
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* VALORES */}
        <div className="border-b border-dashed border-black py-3">
          <div className="flex justify-between">
            <span>Subtotal</span>

            <span>{formatarPreco(Number(pedido.subtotal))}</span>
          </div>

          <div className="mt-1 flex justify-between">
            <span>Entrega</span>

            <span>
              {taxaEntrega === 0 ? "Grátis" : formatarPreco(taxaEntrega)}
            </span>
          </div>

          {taxaCartao > 0 && (
            <div className="mt-1 flex justify-between">
              <span>Taxa cartão</span>

              <span>{formatarPreco(taxaCartao)}</span>
            </div>
          )}

          {descontoFidelidade > 0 && (
            <>
              <div className="mt-1 flex justify-between font-bold">
                <span>Desconto fidelidade</span>
                <span>- {formatarPreco(descontoFidelidade)}</span>
              </div>

              {pontosFidelidadeUsados > 0 && (
                <div className="mt-1 flex justify-between text-[10px]">
                  <span>Pontos utilizados</span>
                  <span>{pontosFidelidadeUsados} pts</span>
                </div>
              )}
            </>
          )}

          {descontoCupom > 0 && codigoCupom && (
            <>
              <div className="mt-1 flex justify-between font-bold">
                <span>Desconto cupom</span>
                <span>- {formatarPreco(descontoCupom)}</span>
              </div>

              <div className="mt-1 flex justify-between gap-3 text-[10px]">
                <span>Cupom</span>
                <span className="break-all text-right font-bold">
                  {codigoCupom}
                </span>
              </div>
            </>
          )}

          <div className="mt-3 flex justify-between border-t border-dashed border-black pt-2 text-base font-black">
            <span>TOTAL</span>

            <span>{formatarPreco(Number(pedido.total))}</span>
          </div>
        </div>

        {/* PAGAMENTO */}
        <div className="border-b border-dashed border-black py-3">
          <p className="font-black uppercase">Pagamento</p>

          <p className="mt-1">{formatarPagamento(pedido.forma_pagamento)}</p>

          {pedido.forma_pagamento === "dinheiro" && pedido.troco_para && (
            <p className="mt-1 font-bold">
              Troco para: {formatarPreco(Number(pedido.troco_para))}
            </p>
          )}
        </div>

        {/* CONFERÊNCIA */}
        <div className="py-3">
          <p className="font-black uppercase">Conferência</p>

          <p className="mt-3">Separado por: ___________________</p>

          <p className="mt-3">Entregador: ____________________</p>
        </div>

        <div className="border-t border-dashed border-black pt-3 text-center">
          <p className="font-black">*** FIM DO PEDIDO ***</p>
        </div>
      </div>
    </div>
  );
}
