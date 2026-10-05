-- =========================================================================================
-- AUTOMATIZACIÓN DE PERFILES Y ROLES - PAPEL VALOR TDD
-- =========================================================================================

-- 1. Función que se ejecutará automáticamente cuando se cree un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol)
  VALUES (
    new.id, 
    -- Toma el nombre de los metadatos, o si está vacío, usa la parte del correo antes del @
    COALESCE(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)), 
    'usuario' -- Rol por defecto para los nuevos
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el Trigger (Disparador) que escucha a auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Backfill (Rellenar): Crear perfiles para los usuarios que ya existen (Como tu correo)
INSERT INTO public.perfiles (id, nombre, rol)
SELECT id, split_part(email, '@', 1), 'usuario'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.perfiles);

-- 4. Convertir forzosamente tu correo principal en Administrador
UPDATE public.perfiles
SET rol = 'admin'
WHERE id IN (SELECT id FROM auth.users WHERE email = 'gh30227421@gmail.com');
