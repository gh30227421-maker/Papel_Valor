-- 1. Crear tabla para guardar la última vez que se actualizó el dashboard
CREATE TABLE IF NOT EXISTS public.dashboard_metadata (
    id INT PRIMARY KEY,
    last_refresh TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insertar el registro inicial si no existe
INSERT INTO public.dashboard_metadata (id, last_refresh) 
VALUES (1, NOW()) 
ON CONFLICT (id) DO NOTHING;

-- 3. Modificar la función de refresco para que guarde la hora exacta
CREATE OR REPLACE FUNCTION public.fn_refresh_dashboard_mv()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW public.mv_dashboard_summary;
    UPDATE public.dashboard_metadata SET last_refresh = NOW() WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
