import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Rutas completamente públicas (no requieren auth)
  const isPublic =
    pathname.startsWith('/menu') ||
    pathname.startsWith('/auth') ||
    pathname === '/login'

  // El usuario es admin si tiene role='admin' en app_metadata (solo Supabase puede escribir esto)
  const isAdmin = user?.app_metadata?.role === 'admin'

  // --- Lógica de acceso ---

  // 1. Rutas públicas: dejar pasar siempre
  if (isPublic) {
    // Si ya está logueado y va a /login:
    // - admin → redirigir al dashboard
    // - cliente Google → redirigir a /menu
    if (user && pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = isAdmin ? '/' : '/menu'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // 2. Rutas admin (todo lo que no es público):
  // Sin login → ir a /login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logueado pero no es admin → redirigir a /menu (cliente de Google)
  if (!isAdmin) {
    const url = request.nextUrl.clone()
    url.pathname = '/menu'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
