import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function obterEmailsAdministradores() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    },
  );

  // Mantém/valida a sessão Supabase.
  await supabase.auth.getClaims();

  const pathname = request.nextUrl.pathname;

  const paginaLoginAdmin = pathname === "/admin/login";

  const rotaAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  const apiAdmin =
    pathname === "/api/admin" || pathname.startsWith("/api/admin/");

  // Rotas públicas continuam normalmente.
  if (!rotaAdmin && !apiAdmin) {
    return supabaseResponse;
  }

  // A página de login precisa continuar pública.
  if (paginaLoginAdmin) {
    return supabaseResponse;
  }

  // Confirma o usuário no servidor.
  const {
    data: { user },
    error: erroUsuario,
  } = await supabase.auth.getUser();

  if (erroUsuario || !user || !user.email) {
    if (apiAdmin) {
      return NextResponse.json(
        {
          erro: "Não autenticado.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";

    return NextResponse.redirect(loginUrl);
  }

  const emailsAdministradores = obterEmailsAdministradores();

  const autorizado = emailsAdministradores.includes(user.email.toLowerCase());

  if (!autorizado) {
    if (apiAdmin) {
      return NextResponse.json(
        {
          erro: "Acesso não autorizado.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";

    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
