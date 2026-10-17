"use client";

import { useState } from "react";

type Pagamento = "" | "pix" | "dinheiro" | "cartao";

type Passo =
  | "endereco"
  | "nome"
  | "cep"
  | "numero"
  | "referencia"
  | "pagamento"
  | "troco"
  | "resumo";

type Props = {
  clienteComDados: boolean;
  nome: string;
  setNome: (valor: string) => void;
  cep: string;
  setCep: (valor: string) => void;
  rua: string;
  bairro: string;
  numero: string;
  setNumero: (valor: string) => void;
  complemento: string;
  setComplemento: (valor: string) => void;
  referencia: string;
  setReferencia: (valor: string) => void;
  formaPagamento: Pagamento;
  setFormaPagamento: (valor: Pagamento) => void;
  trocoPara: string;
  setTrocoPara: (valor: string) => void;
  consultandoCep: boolean;
  erroCep: string;
  consultarCep: () => Promise<void>;
  alterarEnderecoSalvo: () => void;
  totalEstimado: number;
  formatarPreco: (valor: number) => string;
  itens: Array<{
    id: number;
    nome: string;
    quantidade: number;
    preco: number;
    opcoes: Array<{
      nome: string;
      quantidade: number;
    }>;
  }>;
  finalizarPedido: () => Promise<void>;
  enviandoPedido: boolean;
  erroFinalizacao: string;
  concluir: () => void;
};

const campo =
  "h-12 w-full rounded-2xl border border-white/10 " +
  "bg-black/30 px-4 text-base text-white outline-none " +
  "focus:border-amber-400/60";

const botao =
  "h-12 w-full rounded-2xl bg-amber-400 " +
  "font-black text-black disabled:opacity-40";

export default function CheckoutGuiado(props: Props) {
  const {
    clienteComDados,
    nome,
    setNome,
    cep,
    setCep,
    rua,
    bairro,
    numero,
    setNumero,
    complemento,
    setComplemento,
    referencia,
    setReferencia,
    formaPagamento,
    setFormaPagamento,
    trocoPara,
    setTrocoPara,
    consultandoCep,
    erroCep,
    consultarCep,
    alterarEnderecoSalvo,
    totalEstimado,
    formatarPreco,
    itens,
    finalizarPedido,
    enviandoPedido,
    erroFinalizacao,
    concluir,
  } = props;

  const [passo, setPasso] = useState<Passo>(
    clienteComDados ? "endereco" : "nome",
  );

  const [cepBuscado, setCepBuscado] = useState("");
  const cepNumeros = cep.replace(/\D/g, "");

  function avancar(proximo: Passo) {
    setPasso(proximo);

    window.setTimeout(() => {
      document.getElementById("dados-entrega")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 40);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-amber-400/20 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-xl">
            🍺
          </div>

          <div>
            <p className="font-black text-white">
              Assistente do Zé
            </p>
            <p className="text-xs text-emerald-400">
              Finalização assistida
            </p>
          </div>
        </div>

        <p className="mb-5 text-sm text-zinc-300">
          Seu carrinho está pronto. Vamos confirmar
          a entrega e o pagamento.
        </p>

        {passo === "endereco" && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">
              Podemos entregar no endereço salvo?
            </h3>

            <div className="rounded-2xl bg-black/30 p-4 text-sm">
              <p className="font-bold">{nome}</p>
              <p className="mt-2">{rua}, {numero}</p>
              <p>{bairro}</p>
              {complemento && <p>{complemento}</p>}
            </div>

            <button
              type="button"
              className={botao}
              onClick={() => avancar("pagamento")}
            >
              Sim, usar este endereço
            </button>

            <button
              type="button"
              className="w-full py-2 text-sm text-amber-300"
              onClick={() => {
                alterarEnderecoSalvo();
                avancar("cep");
              }}
            >
              Quero alterar o endereço
            </button>
          </div>
        )}

        {passo === "nome" && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">
              Qual é o seu nome?
            </h3>

            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              placeholder="Seu nome"
              className={campo}
            />

            <button
              type="button"
              disabled={!nome.trim()}
              onClick={() => avancar("cep")}
              className={botao}
            >
              Continuar
            </button>
          </div>
        )}

        {passo === "cep" && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">
              Qual é o CEP da entrega?
            </h3>

            <input
              type="text"
              value={cep}
              onChange={(e) => {
                setCep(e.target.value.replace(/[^0-9-]/g, ""));
                setCepBuscado("");
              }}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              className={campo}
            />

            <button
              type="button"
              disabled={cepNumeros.length !== 8 || consultandoCep}
              onClick={async () => {
                await consultarCep();
                setCepBuscado(cepNumeros);
              }}
              className={botao}
            >
              {consultandoCep ? "Consultando..." : "Buscar endereço"}
            </button>

            {erroCep && (
              <p className="text-sm text-amber-300">
                {erroCep}
              </p>
            )}

            {cepBuscado === cepNumeros &&
              Boolean(rua && bairro) && (
                <div className="space-y-3">
                  <p className="rounded-2xl bg-black/30 p-3 text-sm">
                    {rua} — {bairro}
                  </p>

                  <button
                    type="button"
                    className={botao}
                    onClick={() => avancar("numero")}
                  >
                    Continuar
                  </button>
                </div>
              )}
          </div>
        )}

        {passo === "numero" && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">
              Qual é o número da residência?
            </h3>

            <input
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Número"
              className={campo}
            />

            <p className="text-sm text-zinc-400">
              Complemento, se houver:
            </p>

            <input
              type="text"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              placeholder="Casa, apartamento, bloco..."
              className={campo}
            />

            <button
              type="button"
              disabled={!numero.trim()}
              className={botao}
              onClick={() => avancar("referencia")}
            >
              Continuar
            </button>

            <button
              type="button"
              className="w-full text-sm text-amber-300"
              onClick={() => avancar("cep")}
            >
              Voltar ao CEP
            </button>
          </div>
        )}

        {passo === "referencia" && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">
              Tem algum ponto de referência?
            </h3>

            <p className="text-sm text-zinc-400">
              Essa informação é opcional.
            </p>

            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ex: perto da padaria"
              className={campo}
            />

            <button
              type="button"
              className={botao}
              onClick={() => avancar("pagamento")}
            >
              Continuar
            </button>
          </div>
        )}

        {passo === "pagamento" && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">
              Como você prefere pagar?
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["pix", "Pix"],
                  ["dinheiro", "Dinheiro"],
                  ["cartao", "Cartão"],
                ] as const
              ).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setFormaPagamento(valor)}
                  className={`rounded-xl border px-2 py-4 text-sm font-bold ${
                    formaPagamento === valor
                      ? "border-amber-400 bg-amber-400 text-black"
                      : "border-white/10 bg-black/30 text-white"
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>

            {formaPagamento === "cartao" && (
              <p className="text-sm text-amber-300">
                Cartão na entrega: taxa adicional de R$ 2,00.
              </p>
            )}

            <button
              type="button"
              disabled={!formaPagamento}
              className={botao}
              onClick={() => {
                if (formaPagamento === "dinheiro") {
                  avancar("troco");
                } else {
                  avancar("resumo");
                }
              }}
            >
              Conferir pedido
            </button>
          </div>
        )}

        {passo === "troco" && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">
              Precisa de troco?
            </h3>

            <p className="text-sm text-zinc-400">
              Se não precisar, deixe em branco.
            </p>

            <input
              type="text"
              inputMode="decimal"
              value={trocoPara}
              onChange={(e) =>
                setTrocoPara(e.target.value.replace(/[^0-9,.]/g, ""))
              }
              placeholder="Ex: 50,00"
              className={campo}
            />

            <button
              type="button"
              className={botao}
              onClick={() => avancar("resumo")}
            >
              Conferir pedido
            </button>

            <button
              type="button"
              className="w-full text-sm text-amber-300"
              onClick={() => avancar("pagamento")}
            >
              Alterar pagamento
            </button>
          </div>
        )}
        {passo === "resumo" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-black text-white">
                Confira seu pedido
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                Revise tudo antes de enviar para a loja.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl bg-black/30 p-4">
              <p className="font-black text-amber-300">
                Produtos
              </p>

              {itens.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-white/10 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex justify-between gap-3 text-sm">
                    <span>
                      {item.quantidade}x {item.nome}
                    </span>
                    <strong className="whitespace-nowrap">
                      {formatarPreco(item.preco * item.quantidade)}
                    </strong>
                  </div>

                  {item.opcoes.map((opcao, indice) => (
                    <p
                      key={`${item.id}-${indice}`}
                      className="mt-1 text-xs text-zinc-400"
                    >
                      {opcao.quantidade}x {opcao.nome}
                    </p>
                  ))}
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-black/30 p-4 text-sm">
              <p className="font-black text-amber-300">
                Entrega
              </p>
              <p className="mt-2 font-semibold">{nome}</p>
              <p className="mt-1">
                {rua}, {numero}
                {complemento ? ` - ${complemento}` : ""}
              </p>
              <p className="mt-1">{bairro}</p>
              <p className="mt-1 text-zinc-400">
                CEP: {cep}
              </p>
              {referencia && (
                <p className="mt-1 text-zinc-400">
                  Referencia: {referencia}
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-black/30 p-4 text-sm">
              <p className="font-black text-amber-300">
                Pagamento
              </p>

              <p className="mt-2">
                {formaPagamento === "pix"
                  ? "Pix"
                  : formaPagamento === "cartao"
                    ? "Cartao na entrega"
                    : "Dinheiro"}
              </p>

              {formaPagamento === "cartao" && (
                <p className="mt-1 text-xs text-zinc-400">
                  Inclui taxa de cartao de R$ 2,00.
                </p>
              )}

              {formaPagamento === "dinheiro" &&
                trocoPara.trim() && (
                  <p className="mt-1 text-zinc-400">
                    Troco para R$ {trocoPara}
                  </p>
                )}

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <strong>Total estimado</strong>
                <strong className="text-xl text-amber-400">
                  {formatarPreco(totalEstimado)}
                </strong>
              </div>
            </div>

            {erroFinalizacao && (
              <p
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
              >
                {erroFinalizacao}
              </p>
            )}

            <button
              type="button"
              onClick={() => void finalizarPedido()}
              disabled={enviandoPedido || itens.length === 0}
              className="h-14 w-full rounded-2xl bg-emerald-500 font-black text-black disabled:opacity-40"
            >
              {enviandoPedido
                ? "Enviando pedido..."
                : "Confirmar e enviar pedido"}
            </button>

            <button
              type="button"
              disabled={enviandoPedido}
              onClick={() => avancar("pagamento")}
              className="w-full py-2 text-sm font-semibold text-amber-300 disabled:opacity-40"
            >
              Alterar pagamento
            </button>

            <button
              type="button"
              disabled={enviandoPedido}
              onClick={concluir}
              className="w-full py-2 text-sm text-zinc-400 underline disabled:opacity-40"
            >
              Editar dados no formulario completo
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">
            Total estimado
          </p>
          <strong className="text-xl text-amber-400">
            {formatarPreco(totalEstimado)}
          </strong>
        </div>

        <p className="mt-2 text-xs text-zinc-500">
          Confira todos os dados antes de confirmar a compra.
        </p>
      </div>

      <button
        type="button"
        onClick={concluir}
        className="w-full py-3 text-sm text-zinc-400 underline"
      >
        Prefiro preencher o formulário completo
      </button>
    </div>
  );
}