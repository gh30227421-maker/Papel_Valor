-- 1. Habilitar Seguridad a Nivel de Fila (RLS) en la tabla
ALTER TABLE public.dashboard_metadata ENABLE ROW LEVEL SECURITY;

-- 2. Crear política para permitir la lectura de los metadatos a la aplicación
CREATE POLICY "Permitir lectura publica de dashboard_metadata" 
ON public.dashboard_metadata 
FOR SELECT 
USING (true);

-- 3. Crear política para permitir que la aplicación pueda actualizar la fecha
CREATE POLICY "Permitir actualizacion publica de dashboard_metadata" 
ON public.dashboard_metadata 
FOR ALL 
USING (true) 
WITH CHECK (true);
