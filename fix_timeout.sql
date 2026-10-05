-- 1. Crear índices para acelerar masivamente el procesamiento de las Asignaciones Diarias
CREATE INDEX IF NOT EXISTS idx_asig_optimizacion_dashboard 
ON public.asignaciones_diarias (fecha_cod, transaccion, codigo_agencia);

-- 2. Asegurarnos que la función del dashboard tenga más tiempo de vida si es necesario
ALTER FUNCTION public.fn_refresh_dashboard_mv() SET statement_timeout = '60s';

-- 3. Crear índice para búsquedas ultra rápidas en el Stock Actual
CREATE INDEX IF NOT EXISTS idx_stock_correlativo ON public.stock_actual(correlativo);

-- 4. Crear Función de Vaciado Instantáneo (TRUNCATE) para el Stock
-- Permite borrar el stock actual en milisegundos en vez de minutos, evitando que la subida dé timeout.
CREATE OR REPLACE FUNCTION public.fn_truncate_stock_actual()
RETURNS void AS $$
BEGIN
    TRUNCATE TABLE public.stock_actual RESTART IDENTITY;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
