"use client";

import type { PdvCategoria, PdvProduto } from "../app/admin/pdv/page";

export type VendaOffline = {
  id: string;
  tipo: "balcao" | "entrega";
  corpo: Record<string, unknown>;
  pagamento: {
    tipo: "balcao" | "entrega";
    total_esperado: number;
    pagamento_confirmado: boolean;
    parcelas: { forma: "pix" | "dinheiro" | "debito" | "credito"; valor: number; recebido: boolean }[];
  };
  criadaEm: string;
  turnoId: number | null;
  etapa: "registro" | "pagamento";
  registroId?: number;
  numeroTurno?: number | null;
  estado: "pendente" | "revisar";
  mensagem?: string;
};

export type FotoCatalogo = {
  produtos: PdvProduto[];
  categorias: PdvCategoria[];
  atualizadoEm: string;
  turnoId: number | null;
};

export type ResultadoSincronizacao = {
  estado: "sincronizada" | "pendente" | "revisar";
  registroId?: number;
  numeroTurno?: number | null;
  mensagem?: string;
};

const NOME_BANCO = "deposito-ze-pdv-offline-1";
const EVENTO = "deposito-ze-fila-offline";
let travaLocal: Promise<unknown> = Promise.resolve();

function banco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Armazenamento offline indisponível neste navegador."));
      return;
    }
    const pedido = indexedDB.open(NOME_BANCO, 1);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains("vendas")) db.createObjectStore("vendas", { keyPath: "id" });
      if (!db.objectStoreNames.contains("dados")) db.createObjectStore("dados");
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error ?? new Error("Não foi possível abrir o banco local."));
    pedido.onblocked = () => reject(new Error("Feche outras abas antigas do PDV e tente novamente."));
  });
}

async function consultar<T>(tabela: "vendas" | "dados", chave?: IDBValidKey): Promise<T> {
  const db = await banco();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transacao = db.transaction(tabela, "readonly");
      const consulta = chave === undefined ? transacao.objectStore(tabela).getAll() : transacao.objectStore(tabela).get(chave);
      consulta.onsuccess = () => resolve(consulta.result as T);
      consulta.onerror = () => reject(consulta.error ?? new Error("Erro na leitura local."));
      transacao.onabort = () => reject(transacao.error);
    });
  } finally {
    db.close();
  }
}

async function guardar(tabela: "vendas" | "dados", dados: unknown, chave?: IDBValidKey): Promise<void> {
  const db = await banco();
  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = db.transaction(tabela, "readwrite");
      if (chave === undefined) transacao.objectStore(tabela).put(dados);
      else transacao.objectStore(tabela).put(dados, chave);
      transacao.oncomplete = () => resolve();
      transacao.onerror = () => reject(transacao.error ?? new Error("Erro ao salvar localmente."));
      transacao.onabort = () => reject(transacao.error);
    });
  } finally {
    db.close();
  }
  if (tabela === "vendas") window.dispatchEvent(new Event(EVENTO));
}

async function apagarVenda(id: string): Promise<void> {
  const db = await banco();
  try {
    await new Promise<void>((resolve, reject) => {
      const transacao = db.transaction("vendas", "readwrite");
      transacao.objectStore("vendas").delete(id);
      transacao.oncomplete = () => resolve();
      transacao.onerror = () => reject(transacao.error ?? new Error("Erro ao limpar venda sincronizada."));
      transacao.onabort = () => reject(transacao.error);
    });
  } finally {
    db.close();
  }
  window.dispatchEvent(new Event(EVENTO));
}

export async function salvarFotoCatalogo(foto: FotoCatalogo): Promise<void> {
  await guardar("dados", foto, "catalogo");
}

export async function carregarFotoCatalogo(): Promise<FotoCatalogo | undefined> {
  return consultar<FotoCatalogo | undefined>("dados", "catalogo");
}

export async function vendasPendentes(): Promise<VendaOffline[]> {
  const vendas = await consultar<VendaOffline[]>("vendas");
  return vendas.sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
}

export function observarFilaOffline(listener: () => void): () => void {
  window.addEventListener(EVENTO, listener);
  return () => window.removeEventListener(EVENTO, listener);
}

async function atualizar(venda: VendaOffline, estado: "pendente" | "revisar", mensagem: string): Promise<ResultadoSincronizacao> {
  await guardar("vendas", { ...venda, estado, mensagem });
  return { estado, mensagem };
}

type Resposta = { ok: boolean; status: number; dados: Record<string, unknown>; erro?: string; semRede?: boolean };

async function enviar(url: string, corpo: unknown): Promise<Resposta> {
  try {
    const resposta = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(22000),
    });
    const dados = await resposta.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: resposta.ok, status: resposta.status, dados, erro: typeof dados.erro === "string" ? dados.erro : "Servidor retornou HTTP " + resposta.status };
  } catch {
    return { ok: false, status: 0, dados: {}, semRede: true, erro: "Aguardando comunicação com o servidor." };
  }
}

async function executar(venda: VendaOffline): Promise<ResultadoSincronizacao> {
  if (!navigator.onLine) return { estado: "pendente", mensagem: "Sem internet." };

  let atual = venda;
  if (atual.etapa === "registro") {
    // Venda de balcão offline só é enviada ao turno original.
    // Se o servidor recebeu a venda antes de uma queda de conexão, conferir antes
    // de tentar registrá-la num turno diferente.
    if (atual.tipo === "balcao") {
      if (atual.turnoId === null) {
        return atualizar(atual, "revisar", "Turno de caixa não identificado. Confira o registro antes de enviar.");
      }
      try {
        const resposta = await fetch("/api/admin/pdv/contador-turno", { cache: "no-store", signal: AbortSignal.timeout(15000) });
        if (!resposta.ok) {
          if (resposta.status === 401 || resposta.status === 403) {
            return atualizar(atual, "revisar", "Sua sessão expirou. Entre novamente para conferir esta venda.");
          }
          return { estado: "pendente", mensagem: "Aguardando consulta do turno." };
        }
        const dados = await resposta.json() as { turno?: number | null };
        if (dados.turno !== atual.turnoId) {
          return atualizar(atual, "revisar", "O caixa mudou de turno. Confira a venda e os pagamentos no histórico antes de continuar.");
        }
      } catch {
        return { estado: "pendente", mensagem: "Aguardando validação do caixa." };
      }
    }

    const resposta = await enviar(atual.tipo === "balcao" ? "/api/admin/pdv/vendas" : "/api/admin/pdv/entregas", atual.corpo);
    if (!resposta.ok || resposta.dados.sucesso !== true) {
      const erro = resposta.erro ?? "Não foi possível registrar.";
      if (!resposta.semRede && resposta.status >= 400 && resposta.status < 500) return atualizar(atual, "revisar", erro);
      return { estado: "pendente", mensagem: erro };
    }
    const id = Number(atual.tipo === "balcao" ? resposta.dados.venda_id : resposta.dados.pedido_id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return atualizar(atual, "revisar", "Servidor respondeu sem número do registro. Confira o histórico.");
    }
    atual = {
      ...atual, etapa: "pagamento", registroId: id,
      numeroTurno: typeof resposta.dados.numero_turno === "number" ? resposta.dados.numero_turno : null,
      mensagem: undefined,
    };
    // Grava a etapa recebida antes de atualizar pagamentos.
    await guardar("vendas", atual);
  }

  if (!atual.registroId) return atualizar(atual, "revisar", "Registro remoto ausente. Verifique antes de sincronizar.");

  const pagamento = await enviar("/api/admin/pdv/pagamentos", { ...atual.pagamento, registro_id: atual.registroId });
  if (!pagamento.ok || pagamento.dados.sucesso !== true) {
    const erro = pagamento.erro ?? "Pagamento não confirmado.";
    if (!pagamento.semRede && pagamento.status >= 400 && pagamento.status < 500) return atualizar(atual, "revisar", erro);
    return { estado: "pendente", mensagem: erro };
  }
  await apagarVenda(atual.id);
  return { estado: "sincronizada", registroId: atual.registroId, numeroTurno: atual.numeroTurno ?? null };
}

async function comTrava<T>(executarAcao: () => Promise<T>): Promise<T> {
  if (navigator.locks) return navigator.locks.request("deposito-ze-fila-offline", executarAcao);
  const anterior = travaLocal;
  let liberar: () => void = () => {};
  travaLocal = new Promise<void>((resolver) => { liberar = resolver; });
  await anterior.catch(() => undefined);
  try {
    return await executarAcao();
  } finally {
    liberar();
  }
}

export async function registrarVendaLocal(venda: VendaOffline): Promise<ResultadoSincronizacao> {
  return comTrava(async () => {
    const existente = await consultar<VendaOffline | undefined>("vendas", venda.id);
    if (existente && JSON.stringify(existente.corpo) !== JSON.stringify(venda.corpo)) {
      throw new Error("Identificador já existe com dados diferentes. Verifique as pendências.");
    }
    if (!existente) await guardar("vendas", venda);
    return executar(existente ?? venda);
  });
}

export async function sincronizarVendasOffline(): Promise<number> {
  if (!navigator.onLine) return 0;
  return comTrava(async () => {
    let concluidas = 0;
    for (const venda of await vendasPendentes()) {
      if (venda.estado === "revisar") continue;
      const resultado = await executar(venda);
      if (resultado.estado === "sincronizada") concluidas++;
      if (resultado.estado === "pendente") break;
    }
    return concluidas;
  });
}
