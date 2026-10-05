-- =========================================================================================
-- SOLUCIÓN DEFINITIVA: RESTAURAR VELOCIDAD + INCLUIR TRANSACCIÓN 523
-- =========================================================================================

-- 1. Restaurar la Vista Materializada (Nuestra Tabla Dinámica) INCLUYENDO EL 523
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

-- 2. Crear Índices para que vuele
CREATE INDEX IF NOT EXISTS idx_mv_dash_anio ON public.mv_dashboard_summary(anio);
CREATE INDEX IF NOT EXISTS idx_mv_dash_mes ON public.mv_dashboard_summary(mes);
CREATE INDEX IF NOT EXISTS idx_mv_dash_region ON public.mv_dashboard_summary(region);
CREATE INDEX IF NOT EXISTS idx_mv_dash_agencia ON public.mv_dashboard_summary(codigo_agencia);

-- 3. Restaurar la Función Original v6 que lee súper rápido de la vista
CREATE OR REPLACE FUNCTION public.fn_dashboard_stats_v6(
    p_year INT DEFAULT NULL,
    p_month INT DEFAULT NULL,
    p_region VARCHAR DEFAULT NULL,
    p_agencia VARCHAR DEFAULT NULL
)
RETURNS json AS $$
DECLARE
    v_total BIGINT := 0;
    v_promedio NUMERIC := 0;
    v_dias_operativos INT := 1;
    v_transacciones JSON;
    v_top_agencias JSON;
    v_regiones JSON;
    v_estados JSON;
BEGIN
    -- Total
    SELECT COALESCE(SUM(total_asignaciones), 0) INTO v_total
    FROM public.mv_dashboard_summary
    WHERE (p_year IS NULL OR anio = p_year)
      AND (p_month IS NULL OR p_month = 0 OR mes = p_month)
      AND (p_region IS NULL OR p_region = 'Todas' OR p_region = '' OR region = p_region)
      AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia);

    -- Promedio (Días Operativos)
    SELECT COUNT(DISTINCT fecha_cod) INTO v_dias_operativos
    FROM public.mv_dashboard_summary
    WHERE (p_year IS NULL OR anio = p_year)
      AND (p_month IS NULL OR p_month = 0 OR mes = p_month)
      AND (p_region IS NULL OR p_region = 'Todas' OR p_region = '' OR region = p_region)
      AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia);

    IF v_dias_operativos = 0 THEN v_dias_operativos := 1; END IF;
    v_promedio := ROUND((v_total::NUMERIC / v_dias_operativos), 0);

    -- Transacciones
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_transacciones
    FROM (
        SELECT transaccion as name, SUM(total_asignaciones) as value
        FROM public.mv_dashboard_summary
        WHERE (p_year IS NULL OR anio = p_year)
          AND (p_month IS NULL OR p_month = 0 OR mes = p_month)
          AND (p_region IS NULL OR p_region = 'Todas' OR p_region = '' OR region = p_region)
          AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia)
        GROUP BY transaccion
        ORDER BY value DESC
    ) t;

    -- Top 10 Agencias
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_top_agencias
    FROM (
        SELECT agencia_nombre as name, SUM(total_asignaciones) as value
        FROM public.mv_dashboard_summary
        WHERE agencia_nombre IS NOT NULL
          AND (p_year IS NULL OR anio = p_year)
          AND (p_month IS NULL OR p_month = 0 OR mes = p_month)
          AND (p_region IS NULL OR p_region = 'Todas' OR p_region = '' OR region = p_region)
          AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia)
        GROUP BY agencia_nombre
        ORDER BY value DESC
        LIMIT 10
    ) t;

    -- Regiones
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_regiones
    FROM (
        SELECT region as name, SUM(total_asignaciones) as value
        FROM public.mv_dashboard_summary
        WHERE region IS NOT NULL
          AND (p_year IS NULL OR anio = p_year)
          AND (p_month IS NULL OR p_month = 0 OR mes = p_month)
          AND (p_region IS NULL OR p_region = 'Todas' OR p_region = '' OR region = p_region)
          AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia)
        GROUP BY region
        ORDER BY value DESC
    ) t;

    -- Estados
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_estados
    FROM (
        SELECT estado as id, SUM(total_asignaciones) as value
        FROM public.mv_dashboard_summary
        WHERE estado IS NOT NULL
          AND (p_year IS NULL OR anio = p_year)
          AND (p_month IS NULL OR p_month = 0 OR mes = p_month)
          AND (p_region IS NULL OR p_region = 'Todas' OR p_region = '' OR region = p_region)
          AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia)
        GROUP BY estado
        ORDER BY value DESC
    ) t;

    RETURN json_build_object(
        'total', v_total,
        'promedio_diario', v_promedio,
        'transacciones', v_transacciones,
        'top_agencias', v_top_agencias,
        'regiones', v_regiones,
        'estados', v_estados
    );
END;
$$ LANGUAGE plpgsql;
