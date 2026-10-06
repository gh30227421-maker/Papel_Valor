import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isPublicPage = request.nextUrl.pathname.startsWith('/recepcion')

  if (!user && !isAuthPage && !isPublicPage) {
    // Si no está autenticado y no está en /login o /recepcion, redirigir a /login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    // Si está autenticado, verificar su rol en la tabla de perfiles
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    const rol = perfil?.rol || 'invitado'

    // Reglas de acceso según el Rol
    // ADMIN: Tiene acceso a todo.
    // USUARIO: No tiene acceso a /carga ni a /admin (si existiera).
    // INVITADO: Solo tiene acceso a /asignaciones (Dashboard principal).
    
    if (rol === 'invitado' && !request.nextUrl.pathname.startsWith('/asignaciones')) {
      const url = request.nextUrl.clone()
      url.pathname = '/asignaciones'
      return NextResponse.redirect(url)
    }

    if (rol === 'usuario' && (request.nextUrl.pathname.startsWith('/carga') || request.nextUrl.pathname.startsWith('/admin'))) {
      const url = request.nextUrl.clone()
      url.pathname = '/asignaciones'
      return NextResponse.redirect(url)
    }

    // Si intenta ir a /login estando autenticado, mandarlo al inicio
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/asignaciones'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
