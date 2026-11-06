import { redirect } from "next/navigation";

import { verificarAdmin } from "../../../lib/supabase/requireAdmin";
import PedidosPdvConvertidos from "../../../components/pdv/PedidosPdvConvertidos";

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

  return <><PedidosPdvConvertidos />{children}</>;
}
