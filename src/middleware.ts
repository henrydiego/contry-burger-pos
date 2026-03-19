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

  // Rutas completamente públicas (sin auth)
  const isPublic =
    pathname.startsWith('/auth') ||
    pathname === '/login' ||
    pathname.startsWith('/menu') || // menú y checkout son públicos, login es opcional
    pathname.startsWith('/api/') // las APIs manejan su propia auth

  const isMenuRoute = pathname.startsWith('/menu')
  const isAdmin = user?.app_metadata?.role === 'admin'

  // Sin sesión → redirigir a /login
  if (!user) {
    if (isPublic) return supabaseResponse
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Para rutas de menú, pasar el destino para redirigir al volver
    if (isMenuRoute) url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Ya logueado y va a /login → redirigir según rol
  if (pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = isAdmin ? '/' : '/menu'
    return NextResponse.redirect(url)
  }

  // Rutas públicas con sesión activa → dejar pasar
  if (isPublic) return supabaseResponse

  // Cliente Google (no admin): solo puede acceder a /menu
  if (!isAdmin && !isMenuRoute) {
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
