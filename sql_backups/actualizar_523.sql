-- =========================================================================================
-- CORRECCIÓN DEL RPC V6 Y VISTA MATERIALIZADA (INCLUYE 523) CON OPTIMIZACIÓN EXTREMA
-- =========================================================================================

-- 1. Actualizar la Vista Materializada
DROP MATERIALIZED VIEW IF EXISTS public.mv_dashboard_summary CASCADE;

CREATE MATERIALIZED VIEW public.mv_dashboard_summary AS
SELECT 
    EXTRACT(YEAR FROM a.fecha_cod)::INT AS anio,
    EXTRACT(MONTH FROM a.fecha_cod)::INT AS mes,
    a.fecha_cod,
    a.transaccion,
    a.codigo_agencia,
    ag.nombre AS agencia_nombre,
    ag.region,
    ag.estado,
    COUNT(a.id)::INT AS total_asignaciones
FROM public.asignaciones_diarias a
LEFT JOIN public.agencias ag ON a.codigo_agencia = ag.codigo
WHERE a.tdd_nueva IS NOT NULL AND a.tdd_nueva <> ''
  AND a.transaccion IN ('511', '518', '522', '570', '523')
GROUP BY 
    EXTRACT(YEAR FROM a.fecha_cod),
    EXTRACT(MONTH FROM a.fecha_cod),
    a.fecha_cod,
    a.transaccion,
    a.codigo_agencia,
    ag.nombre,
    ag.region,
    ag.estado;

CREATE INDEX IF NOT EXISTS idx_mv_dashboard_anio_mes ON public.mv_dashboard_summary(anio, mes);
CREATE INDEX IF NOT EXISTS idx_mv_dashboard_agencia ON public.mv_dashboard_summary(codigo_agencia);
CREATE INDEX IF NOT EXISTS idx_mv_dashboard_region ON public.mv_dashboard_summary(region);

-- 2. Función Ultra Rápida V6 (Con índices y rango de fechas para evitar timeouts)
CREATE OR REPLACE FUNCTION public.fn_dashboard_stats_v6(
    p_year INT DEFAULT NULL,
    p_month INT DEFAULT NULL,
    p_region VARCHAR DEFAULT NULL,
    p_agencia VARCHAR DEFAULT NULL
)
RETURNS json AS $$
DECLARE
    v_start_date DATE := NULL;
    v_end_date DATE := NULL;
    v_result JSON;
BEGIN
    -- CONVERTIR AÑO Y MES EN RANGOS DE FECHA EXACTOS PARA UTILIZAR LOS ÍNDICES
    IF p_year IS NOT NULL AND p_year > 0 THEN
        IF p_month IS NOT NULL AND p_month > 0 THEN
            v_start_date := make_date(p_year, p_month, 1);
            v_end_date := (v_start_date + interval '1 month - 1 day')::date;
        ELSE
            v_start_date := make_date(p_year, 1, 1);
            v_end_date := make_date(p_year, 12, 31);
        END IF;
    END IF;

    -- CTE MATERIALIZADO: Postgres filtrará a un subset minúsculo en memoria usando B-Tree Index
    WITH filtered_data AS MATERIALIZED (
        SELECT 
            a.id, 
            a.transaccion, 
            a.fecha_cod, 
            ag.nombre AS agencia_nombre, 
            ag.region, 
            ag.estado
        FROM public.asignaciones_diarias a
        LEFT JOIN public.agencias ag ON a.codigo_agencia = ag.codigo
        WHERE a.tdd_nueva IS NOT NULL AND a.tdd_nueva <> ''
          AND a.transaccion IN ('511', '518', '522', '570', '523')
          AND (v_start_date IS NULL OR a.fecha_cod >= v_start_date)
          AND (v_end_date IS NULL OR a.fecha_cod <= v_end_date)
          AND (p_region IS NULL OR p_region = 'Todas' OR p_region = '' OR ag.region = p_region)
          AND (p_agencia IS NULL OR p_agencia = '' OR a.codigo_agencia = p_agencia)
    ),
    t_total AS (
        SELECT COUNT(id) AS total, GREATEST(COUNT(DISTINCT fecha_cod), 1) as dias_operativos
        FROM filtered_data
    ),
    t_transacciones AS (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]') as data
        FROM (SELECT transaccion as name, COUNT(id) as value FROM filtered_data GROUP BY transaccion ORDER BY value DESC) t
    ),
    t_top_agencias AS (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]') as data
        FROM (SELECT agencia_nombre as name, COUNT(id) as value FROM filtered_data WHERE agencia_nombre IS NOT NULL GROUP BY agencia_nombre ORDER BY value DESC LIMIT 10) t
    ),
    t_regiones AS (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]') as data
        FROM (SELECT region as name, COUNT(id) as value FROM filtered_data WHERE region IS NOT NULL GROUP BY region ORDER BY value DESC) t
    ),
    t_estados AS (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]') as data
        FROM (SELECT estado as id, COUNT(id) as value FROM filtered_data WHERE estado IS NOT NULL GROUP BY estado ORDER BY value DESC) t
    )
    SELECT json_build_object(
        'total', (SELECT total FROM t_total),
        'promedio_diario', ROUND(((SELECT total FROM t_total)::NUMERIC / (SELECT dias_operativos FROM t_total)), 0),
        'transacciones', (SELECT data FROM t_transacciones),
        'top_agencias', (SELECT data FROM t_top_agencias),
        'regiones', (SELECT data FROM t_regiones),
        'estados', (SELECT data FROM t_estados)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
