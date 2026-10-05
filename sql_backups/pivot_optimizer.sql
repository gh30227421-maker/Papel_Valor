-- =========================================================================================
-- SCRIPT SEGURO PARA LA TABLA DINÁMICA (NO TOCA EL DASHBOARD PRINCIPAL)
-- =========================================================================================
-- Descripción: Crea una función independiente EXCLUSIVA para la tabla dinámica mensual,
-- garantizando que cargue el 100% de la data (superando el límite de 1000 filas de Supabase).

CREATE OR REPLACE FUNCTION public.fn_dashboard_monthly_pivot(
    p_year INT DEFAULT NULL,
    p_region VARCHAR DEFAULT NULL,
    p_agencia VARCHAR DEFAULT NULL
)
RETURNS json AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_result
    FROM (
        SELECT 
            mes,
            transaccion,
            SUM(total_asignaciones) AS total_asignaciones
        FROM public.mv_dashboard_summary
        WHERE (p_year IS NULL OR p_year = 0 OR anio = p_year)
          AND (p_region IS NULL OR p_region = 'Todas' OR p_region = '' OR region = p_region)
          AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia)
        GROUP BY mes, transaccion
        ORDER BY mes ASC
    ) t;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
