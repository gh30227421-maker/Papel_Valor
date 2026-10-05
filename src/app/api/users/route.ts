import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    // 1. Verificamos quién está haciendo la petición usando las cookies (El Admin)
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            // Read-only en esta ruta
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Verificamos que el usuario logueado realmente sea 'admin'
    const { data: perfilInfo } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    const userRol = perfilInfo?.rol;

    if (userRol !== 'admin') {
      return NextResponse.json({ error: 'Permisos insuficientes. Solo los administradores pueden crear usuarios.' }, { status: 403 })
    }

    // 3. Obtenemos los datos enviados desde el formulario (nombre, correo, password, rol)
    const body = await request.json()
    const { email, password, nombre, rol } = body

    if (!email || !password || !nombre || !rol) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }

    // 4. Creamos un Cliente Supabase de ADMINISTRADOR usando la SERVICE_ROLE_KEY
    // Esta llave ignora el RLS y tiene poder absoluto. Solo existe en el servidor.
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 5. Creamos al usuario en auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirmar el correo
      user_metadata: {
        nombre: nombre
      }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 6. Actualizamos su perfil en la tabla 'perfiles' (El trigger ya lo insertó)
    const newUserId = authData.user.id
    const { error: dbError } = await supabaseAdmin
      .from('perfiles')
      .update({
        nombre: nombre,
        rol: rol
      })
      .eq('id', newUserId)

    if (dbError) {
      return NextResponse.json({ error: `Usuario creado, pero falló actualizar el perfil: ${dbError.message}` }, { status: 400 })
    }

    // 7. Éxito
    return NextResponse.json({ message: 'Usuario creado exitosamente', user: authData.user }, { status: 200 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 })
  }
}
