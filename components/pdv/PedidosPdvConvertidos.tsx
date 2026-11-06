"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Entrega = {
  id: number;
  created_at: string;
  total: number;
  forma_pagamento: string;
  dados_entrega: Record<string, string> | null;
};

type Item = {
  venda_id: number;
  nome_produto: string;
  quantidade: number;
  subtotal: number;
};

const titulos: Record<string, string> = {
  recebido: "Recebido",
  em_preparacao: "Em preparacao",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue"
};

const proximos: Record<string, string[]> = {
  recebido: ["em_preparacao", "saiu_entrega", "entregue"],
  em_preparacao: ["saiu_entrega", "entregue"],
  saiu_entrega: ["entregue"],
  entregue: []
};

const moeda = (valor: number) =>
  Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

function escaparHtmlComanda(valor: unknown): string {
  const mapa: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(valor ?? "").replace(
    /[&<>"']/g,
    (caractere) => mapa[caractere] ?? caractere
  );
}

function imprimirComandaConvertida(
  venda: Entrega,
  produtos: Item[]
) {
  const janela = window.open(
    "",
    "_blank",
    "width=430,height=750"
  );

  if (!janela) {
    window.alert(
      "Permita pop-ups para imprimir a comanda."
    );
    return;
  }

  const dados = venda.dados_entrega ?? {};
  const seguro = escaparHtmlComanda;

  const linha = (rotulo: string, valor: unknown) =>
    valor
      ? `<div><strong>${seguro(rotulo)}:</strong> ${seguro(valor)}</div>`
      : "";

  const data = new Date(venda.created_at).toLocaleString(
    "pt-BR",
    { timeZone: "America/Sao_Paulo" }
  );

  const status = dados.status_entrega || "recebido";

  const linhasProdutos = produtos.map((produto) => `
    <tr>
      <td>
        ${seguro(produto.quantidade)}x
        ${seguro(produto.nome_produto)}
      </td>
      <td class="valor">
        ${seguro(moeda(produto.subtotal))}
      </td>
    </tr>
  `).join("");

  const html = `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Comanda PDV ${seguro(venda.id)}</title>
      <style>
        @page {
          margin: 3mm;
        }

        * {
          box-sizing: border-box;
        }

        body {
          width: 72mm;
          max-width: 72mm;
          margin: 0 auto;
          padding: 2mm;
          font-family: Arial, sans-serif;
          color: #000;
          font-size: 12px;
        }

        h1, h2, p {
          margin: 0;
        }

        h1 {
          text-align: center;
          font-size: 19px;
          font-weight: 900;
        }

        h2 {
          text-align: center;
          font-size: 14px;
          margin: 5px 0;
        }

        .centro {
          text-align: center;
        }

        .linha {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }

        .dados {
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        td {
          padding: 4px 2px;
          vertical-align: top;
          overflow-wrap: anywhere;
        }

        td.valor {
          width: 26mm;
          text-align: right;
          white-space: nowrap;
        }

        .total {
          font-size: 18px;
          font-weight: 900;
          text-align: right;
        }

        .acoes {
          text-align: center;
          padding: 10px 0;
        }

        button {
          padding: 10px 16px;
          font-weight: bold;
          cursor: pointer;
        }

        @media print {
          .acoes {
            display: none;
          }
          body {
            width: 72mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="acoes">
        <button onclick="window.print()">IMPRIMIR</button>
      </div>

      <h1>DEPOSITO DO ZE</h1>
      <h2>COMANDA DE ENTREGA</h2>

      <p class="centro">
        <strong>Entrega PDV #${seguro(venda.id)}</strong>
      </p>

      <p class="centro">${seguro(data)}</p>

      <div class="linha"></div>

      <div class="dados">
        ${linha("Cliente", dados.nome || "Nao identificado")}
        ${linha("Telefone", dados.telefone)}
        ${linha("Rua", dados.rua)}
        ${linha("Numero", dados.numero)}
        ${linha("Bairro", dados.bairro)}
        ${linha("Complemento", dados.complemento)}
        ${linha("CEP", dados.cep)}
        ${linha("Referencia", dados.referencia)}
        ${linha("Observacoes", dados.observacoes)}
      </div>

      <div class="linha"></div>

      <strong>PRODUTOS</strong>

      <table>
        <tbody>
          ${
            linhasProdutos ||
            "<tr><td>Itens indisponiveis</td></tr>"
          }
        </tbody>
      </table>

      <div class="linha"></div>

      <div class="total">
        TOTAL: ${seguro(moeda(venda.total))}
      </div>

      <div class="dados">
        ${linha("Pagamento original", venda.forma_pagamento)}
        ${linha("Status da entrega", titulos[status] || status)}
      </div>

      <div class="linha"></div>

      <p class="centro">VENDA JA REGISTRADA NO PDV</p>
      <p class="centro">
        Nao cobrar novamente se o pagamento ja foi recebido.
      </p>
    </body>
    </html>
  `;

  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.focus();

  janela.setTimeout(() => {
    janela.print();
  }, 350);
}

export default function PedidosPdvConvertidos({
  idsPermitidos
}: {
  idsPermitidos: number[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  const nestaPagina = pathname.replace(/\/$/, "") === "/admin/pedidos";

  async function carregar() {
    setCarregando(true);
    setErro("");

    try {
      const r = await fetch("/api/admin/pdv/entregas-convertidas", {
        cache: "no-store"
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.erro || "Erro na consulta");
      setEntregas(j.entregas || []);
      setItens(j.itens || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (nestaPagina) void carregar();
  }, [nestaPagina]);

  async function mudar(id: number, status: string) {
    setOcupado(id);
    setErro("");

    try {
      const r = await fetch("/api/admin/pdv/entregas-convertidas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venda_id: id, status })
      });
      const j = await r.json();
      if (!r.ok || !j.sucesso) throw Error(j.erro || "Falha");
      await carregar();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setOcupado(null);
    }
  }

  if (!nestaPagina || idsPermitidos.length === 0) return null;

  const visiveis = entregas.filter((v) => idsPermitidos.includes(v.id));

  return <section className="bg-[#080808] px-4 pt-5 text-white">
    <div className="mx-auto max-w-7xl rounded-2xl border border-blue-400/30 bg-zinc-950 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-blue-300">
            Entregas convertidas do PDV
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Vendas corrigidas do balcao para delivery, sem nova baixa de estoque.
          </p>
        </div>
        <button type="button" onClick={() => void carregar()}
          className="rounded-lg border border-white/20 px-3 py-2 text-sm">
          Atualizar
        </button>
      </div>

      {carregando && <p className="mt-3 text-sm">Carregando...</p>}
      {erro && <p role="alert" className="mt-3 text-sm text-red-300">{erro}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {visiveis.map(v => {
          const d = v.dados_entrega || {};
          const status = d.status_entrega || "recebido";
          const endereco = [d.rua, d.numero, d.bairro]
            .filter(Boolean).join(", ");

          return <div key={v.id}
            className="rounded-xl border border-white/10 bg-black/40 p-4">

            <div className="flex items-center justify-between gap-2">
              <b>Entrega PDV #{v.id}</b>
              <span className="text-xs font-bold text-blue-300">
                {titulos[status] || status}
              </span>
            </div>

            <p className="mt-2 text-sm font-bold">
              {d.nome || "Cliente nao identificado"}
            </p>
            <p className="text-sm text-zinc-300">{endereco}</p>
            <p className="text-xs text-zinc-400">{d.telefone}</p>
            <p className="mt-2 text-lg font-black text-emerald-300">
              {moeda(v.total)}
            </p>
            <p className="text-xs text-zinc-400">
              Pagamento original: {v.forma_pagamento}
            </p>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-bold text-blue-300">
                Ver produtos
              </summary>
              <div className="mt-2 space-y-2 text-xs">
                {itens.filter(i => i.venda_id === v.id).map((i, n) =>
                  <div key={n} className="flex justify-between gap-2">
                    <span>{i.quantidade}x {i.nome_produto}</span>
                    <span>{moeda(i.subtotal)}</span>
                  </div>
                )}
              </div>
            </details>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => imprimirComandaConvertida(
                  v,
                  itens.filter((item) => item.venda_id === v.id)
                )}
                className="rounded-lg border border-amber-400/40 bg-amber-400 px-3 py-2 text-xs font-black text-zinc-950 hover:bg-amber-300"
              >
                Imprimir comanda
              </button>
              {(proximos[status] || []).map(proximo =>
                <button key={proximo} type="button"
                  disabled={ocupado === v.id}
                  onClick={() => void mudar(v.id, proximo)}
                  className="rounded-lg border border-blue-400/40 px-3 py-2 text-xs font-bold text-blue-200 disabled:opacity-50">
                  {ocupado === v.id ? "Salvando..." : titulos[proximo]}
                </button>
              )}
            </div>
          </div>;
        })}
      </div>

      {!carregando && !erro && visiveis.length === 0 &&
        <p className="mt-3 text-sm text-zinc-400">Nenhuma entrega convertida.</p>}
    </div>
  </section>;
}