"use client";

import { useRouter } from "next/navigation";

import { createClient } from "../lib/supabase/client";

export default function AdminLogoutButton() {
  const router = useRouter();

  async function sair() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={sair}
      className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-red-500 hover:text-red-400"
    >
      🚪 Sair do painel
    </button>
  );
}