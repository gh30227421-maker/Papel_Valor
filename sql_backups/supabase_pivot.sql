-- ==========================================
-- PIVOT MENSUAL DE ASIGNACIONES (TABLA DINAMICA)
-- ==========================================

CREATE OR REPLACE FUNCTION public.fn_dashboard_monthly_pivot(
    p_year INT
)
RETURNS json AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_result
    FROM (
        SELECT 
            EXTRACT(MONTH FROM a.fecha_cod)::INT AS mes,
            SUM(CASE WHEN transaccion = '511' THEN 1 ELSE 0 END) AS primera_vez,
            SUM(CASE WHEN transaccion = '518' THEN 1 ELSE 0 END) AS reposicion,
            SUM(CASE WHEN transaccion = '522' THEN 1 ELSE 0 END) AS migracion_bnc,
            SUM(CASE WHEN transaccion = '570' THEN 1 ELSE 0 END) AS migracion_bod,
            SUM(CASE WHEN transaccion NOT IN ('511', '518', '522', '570') THEN 1 ELSE 0 END) AS pensionado,
            COUNT(id) AS total
        FROM public.asignaciones_diarias a
        WHERE a.tdd_nueva IS NOT NULL AND a.tdd_nueva <> ''
          AND EXTRACT(YEAR FROM a.fecha_cod) = p_year
        GROUP BY EXTRACT(MONTH FROM a.fecha_cod)
        ORDER BY mes ASC
    ) t;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
