import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Intentamos hacer una consulta básica para probar la conexión
    // Consultar una tabla inexistente no falla la conexión, pero un error de auth o url inválida sí fallaría.
    // También podemos usar `auth.getSession()` para ver si el cliente inicializa bien.
    
    // Solo verificamos que la instancia exista y las variables estén cargadas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ success: false, message: 'Variables de entorno no configuradas.' }, { status: 500 });
    }

    const { data, error } = await supabase.from('_non_existent_table').select('*').limit(1);
    
    // Si el error es de que la relación/tabla no existe, significa que ¡la conexión a la base de datos funciona!
    if (error && error.code === '42P01') {
      return NextResponse.json({ success: true, message: '¡Conexión exitosa a Supabase!' });
    }

    if (error) {
       return NextResponse.json({ success: false, message: 'Error al conectar.', error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '¡Conexión exitosa a Supabase!' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Excepción al conectar', error: err.message }, { status: 500 });
  }
}
