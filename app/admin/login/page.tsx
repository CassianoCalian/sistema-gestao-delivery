"use client";

import { FormEvent, useState } from "react";

import { createClient } from "../../../lib/supabase/client";
import Image from "next/image";
import { Yellowtail } from "next/font/google";

const yellowtail = Yellowtail({
  weight: "400",
  subsets: ["latin"],
});

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
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070707] px-6 py-10 text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 10%, rgba(245,158,11,0.14), transparent 30%), radial-gradient(circle at 10% 85%, rgba(245,158,11,0.06), transparent 26%), radial-gradient(circle at 90% 75%, rgba(249,115,22,0.05), transparent 24%)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/[0.04] blur-[120px]"
      />

      {/* LUZ ÂMBAR EM MOVIMENTO */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[8%] top-[18%] hidden h-[360px] w-[360px] rounded-full bg-amber-400/[0.08] blur-[120px] xl:block"
        style={{
          animation: "admin-glow 7s ease-in-out infinite",
        }}
      />

      {/* FEIXE DE LUZ */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[20%] left-0 hidden h-[140%] w-[180px] bg-gradient-to-r from-transparent via-amber-300/[0.08] to-transparent blur-2xl xl:block"
        style={{
          animation: "admin-light-sweep 10s linear infinite",
        }}
      />

      {/* BOLHAS / PARTÍCULAS */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[12%] top-[30%] hidden xl:block"
      >
        <span
          className="absolute h-3 w-3 rounded-full border border-amber-300/20 bg-amber-300/[0.04]"
          style={{ animation: "admin-float 5s ease-in-out infinite" }}
        />

        <span
          className="absolute left-16 top-24 h-5 w-5 rounded-full border border-amber-300/15 bg-amber-300/[0.03]"
          style={{
            animation: "admin-float 7s ease-in-out infinite",
            animationDelay: "1s",
          }}
        />

        <span
          className="absolute -left-10 top-44 h-2 w-2 rounded-full bg-amber-300/20"
          style={{
            animation: "admin-float 4s ease-in-out infinite",
            animationDelay: "0.5s",
          }}
        />

        <span
          className="absolute left-24 top-60 h-4 w-4 rounded-full border border-amber-300/10"
          style={{
            animation: "admin-float 6s ease-in-out infinite",
            animationDelay: "2s",
          }}
        />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[7%] top-1/2 hidden -translate-y-1/2 xl:block"
      >
        <p
          className={`${yellowtail.className} -rotate-6 text-[64px] leading-[0.9] text-amber-500/[0.22]`}
        >
          Bebidas
          <br />
          para bons
          <br />
          momentos
        </p>

        <div className="ml-8 mt-5 h-[3px] w-32 rotate-[-8deg] rounded-full bg-amber-400/25" />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-10 top-10 hidden xl:block"
      >
        <div className="mb-3 h-px w-8 bg-amber-400/70" />

        <p className="text-[9px] font-black uppercase leading-5 tracking-[0.28em] text-zinc-500">
          Qualidade
          <br />
          Variedade
          <br />
          Bons momentos
        </p>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-10 right-10 hidden text-right xl:block"
      >
        <div className="mb-3 ml-auto h-px w-8 bg-amber-400/70" />

        <p className="text-[9px] font-black uppercase leading-5 tracking-[0.28em] text-zinc-500">
          Mais que bebidas,
          <br />
          bons momentos
        </p>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 right-4 hidden xl:block"
      >
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-amber-500/10 blur-3xl" />

          <Image
            src="/garrafa-admin-v2.png"
            alt=""
            width={300}
            height={600}
            loading="eager"
            className="admin-float relative z-10 h-auto w-[400px] opacity-[0.18] drop-shadow-[0_0_30px_rgba(245,158,11,0.16)]"
          />

          <span className="admin-bubble absolute right-[120px] top-[40px] h-2 w-2 rounded-full bg-amber-300/30" />
          <span className="admin-bubble-delayed absolute right-[90px] top-[120px] h-3 w-3 rounded-full border border-amber-300/20" />
          <span className="admin-bubble-slow absolute right-[150px] top-[200px] h-1.5 w-1.5 rounded-full bg-amber-200/30" />
          <span className="admin-bubble-delayed absolute right-[70px] top-[280px] h-2.5 w-2.5 rounded-full border border-amber-300/15" />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md rounded-[30px] border border-white/[0.08] bg-zinc-900/90 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.55),0_0_60px_rgba(245,158,11,0.05)] backdrop-blur-xl">
        <div className="text-center">
          <div className="flex justify-center">
            <Image
              src="/logo-deposito-ze.png"
              alt="Depósito do Zé"
              width={180}
              height={110}
              priority
              style={{
                width: "180px",
                height: "auto",
              }}
              className="object-contain"
            />
          </div>

          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
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
              className="w-full rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3.5 text-sm font-medium text-white outline-none transition duration-300 placeholder:text-zinc-600 hover:border-white/[0.12] focus:border-amber-400/60 focus:bg-black/45 focus:shadow-[0_0_0_4px_rgba(251,191,36,0.06)]"
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
            className="w-full rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 px-6 py-4 font-black text-zinc-950 shadow-[0_12px_35px_rgba(245,158,11,0.18)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(245,158,11,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando ? "Entrando..." : "Entrar no painel"}
          </button>
        </form>
      </div>
    </main>
  );
}
