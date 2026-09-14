import { createClient } from "./server";

async function obterAdminAtual() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return null;
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(user.email.toLowerCase())) {
    return null;
  }

  return user;
}

export async function verificarAdmin() {
  const user = await obterAdminAtual();

  return Boolean(user);
}

export async function requireAdmin() {
  const user = await obterAdminAtual();

  if (!user) {
    throw new Error("Acesso não autorizado.");
  }

  return user;
}
