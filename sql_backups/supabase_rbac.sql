-- =========================================================================================
-- SISTEMA DE AUTENTICACIÓN Y ROLES (RBAC) - PAPEL VALOR TDD
-- Autor: Arquitectura Full-Stack Next.js + Supabase
-- =========================================================================================

-- 1. Tabla de Perfiles (Extensión de auth.users)
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    rol VARCHAR(50) CHECK (rol IN ('admin', 'usuario', 'invitado')) NOT NULL DEFAULT 'usuario',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar Seguridad de Nivel de Fila (RLS)
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (Policies)
-- Política 1: Todos los usuarios autenticados pueden ver su propio perfil (y el de los demás para tablas/UI).
CREATE POLICY "Permitir lectura de perfiles a usuarios autenticados" 
ON public.perfiles FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Política 2: Solo los usuarios con rol 'admin' pueden insertar/modificar perfiles.
-- NOTA: El primer admin deberá ser configurado manualmente en Supabase, o mediante el service_role.
CREATE POLICY "Permitir gestión a administradores" 
ON public.perfiles FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.rol = 'admin'
    )
);

-- 4. Funciones de Ayuda (Opcional, para verificar roles rápido desde el frontend)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS VARCHAR AS $$
DECLARE
    v_rol VARCHAR;
BEGIN
    SELECT rol INTO v_rol FROM public.perfiles WHERE id = auth.uid();
    RETURN v_rol;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
