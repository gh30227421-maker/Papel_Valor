-- =========================================================================================
-- CORRECCIÓN DE RECURSIÓN INFINITA EN POLÍTICAS RLS - PAPEL VALOR
-- =========================================================================================

-- 1. Eliminar TODAS las políticas problemáticas de la tabla perfiles
DROP POLICY IF EXISTS "Permitir lectura de perfiles a usuarios autenticados" ON public.perfiles;
DROP POLICY IF EXISTS "Permitir gestion a administradores" ON public.perfiles;
DROP POLICY IF EXISTS "Lectura general de perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Actualizacion por admins" ON public.perfiles;

-- Asegurarnos que el RLS esté activo
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 2. Política de LECTURA (SELECT): Cualquiera que haya iniciado sesión puede ver la lista.
-- (Al no hacer subconsultas a perfiles aquí, cortamos el bucle de recursión infinita).
CREATE POLICY "Lectura general de perfiles" 
ON public.perfiles FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 3. Política de ACTUALIZACIÓN (UPDATE): Solo los admins pueden cambiar roles.
-- Esta política usa una subconsulta, pero como la política de SELECT es simple, no causa recursión.
CREATE POLICY "Actualizacion por admins" 
ON public.perfiles FOR UPDATE 
USING (
  (SELECT rol FROM public.perfiles WHERE id = auth.uid()) = 'admin'
);

-- (La creación de usuarios ya la manejamos por el servidor con la clave maestra, 
-- así que no necesitamos políticas de INSERT o DELETE en el cliente).
