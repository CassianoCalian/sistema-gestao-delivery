import { redirect } from "next/navigation";
import { verificarAdmin } from "../../../lib/supabase/requireAdmin";
import ComprasClient from "../../../components/compras/ComprasClient";

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  if (!(await verificarAdmin())) redirect("/admin/login");
  return <ComprasClient />;
}