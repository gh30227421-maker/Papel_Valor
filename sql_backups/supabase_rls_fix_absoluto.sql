-- =========================================================================================
-- ERRADICACIÓN TOTAL DE RECURSIÓN INFINITA - PAPEL VALOR TDD
-- =========================================================================================

-- 1. Eliminar absolutamente TODAS las políticas existentes en la tabla perfiles
-- (Sin importar qué nombre les hayas puesto, esto las barrerá todas)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'perfiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.perfiles', pol.policyname);
    END LOOP;
END
$$;

-- 2. Crear una función segura que revisa si eres admin (Bypassea el RLS para no causar bucles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear Política de Lectura (Cualquier logueado puede leer)
CREATE POLICY "Lectura_General" 
ON public.perfiles FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 4. Crear Política de Actualización (Usando la función segura)
CREATE POLICY "Actualizacion_Segura_Admins" 
ON public.perfiles FOR UPDATE 
USING ( public.is_admin() );
