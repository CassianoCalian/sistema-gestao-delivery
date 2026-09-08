import { redirect } from "next/navigation";

import { verificarAdmin } from "../../../lib/supabase/requireAdmin";

type AdminPedidosLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminPedidosLayout({
  children,
}: AdminPedidosLayoutProps) {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}
