"use client";

import { FormEvent, useState } from "react";

import { createClient } from "../../../lib/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function fazerLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setCarregando(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        throw new Error("E-mail ou senha incorretos.");
      }

      window.location.replace("/admin/pedidos");
    } catch (error) {
      if (error instanceof Error) {
        setErro(error.message);
      } else {
        setErro("Não foi possível realizar o login.");
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-widest text-amber-400">
            Depósito do Zé
          </p>

          <h1 className="mt-2 text-3xl font-black">Painel administrativo</h1>

          <p className="mt-2 text-sm text-zinc-400">
            Entre com sua conta para acessar os pedidos.
          </p>
        </div>

        <form onSubmit={fazerLogin} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold">E-mail</label>

            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@exemplo.com"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold">Senha</label>

            <input
              type="password"
              required
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              placeholder="Digite sua senha"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
            />
          </div>

          {erro && (
            <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm font-bold text-red-300">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-amber-400 px-6 py-4 font-black text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando ? "Entrando..." : "Entrar no painel"}
          </button>
        </form>
      </div>
    </main>
  );
}
