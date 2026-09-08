import { createClient } from "./server";

export async function verificarAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return false;
  }

  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    return false;
  }

  return user.email.toLowerCase() === adminEmail.toLowerCase();
}
