-- =========================================================================================
-- MASTER DASHBOARD OPTIMIZER & CLEANUP SCRIPT V7 (MULTI-SELECT & DAYS)
-- =========================================================================================

-- 1. DROP PREVIOUS CONFLICTING FUNCTIONS IF ANY
DROP FUNCTION IF EXISTS public.fn_dashboard_stats_v7(INT[], INT[], INT[], TEXT[], TEXT[]);
DROP FUNCTION IF EXISTS public.fn_dashboard_monthly_pivot_v7(INT[], TEXT[], TEXT[]);

-- 2. FUNCIÓN RPC PARA EL FRONTEND (NEXT.JS) - V7 MULTI-SELECT
CREATE OR REPLACE FUNCTION public.fn_dashboard_stats_v7(
    p_years INT[] DEFAULT NULL,
    p_months INT[] DEFAULT NULL,
    p_days INT[] DEFAULT NULL,
    p_regions TEXT[] DEFAULT NULL,
    p_agencias TEXT[] DEFAULT NULL
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
    -- Cálculo de Total General
    SELECT COALESCE(SUM(total_asignaciones), 0) INTO v_total
    FROM public.mv_dashboard_summary
    WHERE (p_years IS NULL OR array_length(p_years, 1) IS NULL OR anio = ANY(p_years))
      AND (p_months IS NULL OR array_length(p_months, 1) IS NULL OR mes = ANY(p_months))
      AND (p_days IS NULL OR array_length(p_days, 1) IS NULL OR EXTRACT(DAY FROM fecha_cod)::INT = ANY(p_days))
      AND (p_regions IS NULL OR array_length(p_regions, 1) IS NULL OR region = ANY(p_regions))
      AND (p_agencias IS NULL OR array_length(p_agencias, 1) IS NULL OR codigo_agencia = ANY(p_agencias));

    -- Días Operativos Reales para el Promedio
    SELECT COUNT(DISTINCT fecha_cod) INTO v_dias_operativos
    FROM public.mv_dashboard_summary
    WHERE (p_years IS NULL OR array_length(p_years, 1) IS NULL OR anio = ANY(p_years))
      AND (p_months IS NULL OR array_length(p_months, 1) IS NULL OR mes = ANY(p_months))
      AND (p_days IS NULL OR array_length(p_days, 1) IS NULL OR EXTRACT(DAY FROM fecha_cod)::INT = ANY(p_days))
      AND (p_regions IS NULL OR array_length(p_regions, 1) IS NULL OR region = ANY(p_regions))
      AND (p_agencias IS NULL OR array_length(p_agencias, 1) IS NULL OR codigo_agencia = ANY(p_agencias));

    IF v_dias_operativos = 0 THEN v_dias_operativos := 1; END IF;
    v_promedio := ROUND((v_total::NUMERIC / v_dias_operativos), 0);

    -- Gráfico de Transacciones
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_transacciones
    FROM (
        SELECT transaccion as name, SUM(total_asignaciones) as value
        FROM public.mv_dashboard_summary
        WHERE (p_years IS NULL OR array_length(p_years, 1) IS NULL OR anio = ANY(p_years))
          AND (p_months IS NULL OR array_length(p_months, 1) IS NULL OR mes = ANY(p_months))
          AND (p_days IS NULL OR array_length(p_days, 1) IS NULL OR EXTRACT(DAY FROM fecha_cod)::INT = ANY(p_days))
          AND (p_regions IS NULL OR array_length(p_regions, 1) IS NULL OR region = ANY(p_regions))
          AND (p_agencias IS NULL OR array_length(p_agencias, 1) IS NULL OR codigo_agencia = ANY(p_agencias))
        GROUP BY transaccion
        ORDER BY value DESC
    ) t;

    -- Gráfico Top 10 Agencias
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_top_agencias
    FROM (
        SELECT agencia_nombre as name, SUM(total_asignaciones) as value
        FROM public.mv_dashboard_summary
        WHERE agencia_nombre IS NOT NULL
          AND (p_years IS NULL OR array_length(p_years, 1) IS NULL OR anio = ANY(p_years))
          AND (p_months IS NULL OR array_length(p_months, 1) IS NULL OR mes = ANY(p_months))
          AND (p_days IS NULL OR array_length(p_days, 1) IS NULL OR EXTRACT(DAY FROM fecha_cod)::INT = ANY(p_days))
          AND (p_regions IS NULL OR array_length(p_regions, 1) IS NULL OR region = ANY(p_regions))
          AND (p_agencias IS NULL OR array_length(p_agencias, 1) IS NULL OR codigo_agencia = ANY(p_agencias))
        GROUP BY agencia_nombre
        ORDER BY value DESC
        LIMIT 10
    ) t;

    -- Gráfico Regiones
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_regiones
    FROM (
        SELECT region as name, SUM(total_asignaciones) as value
        FROM public.mv_dashboard_summary
        WHERE region IS NOT NULL
          AND (p_years IS NULL OR array_length(p_years, 1) IS NULL OR anio = ANY(p_years))
          AND (p_months IS NULL OR array_length(p_months, 1) IS NULL OR mes = ANY(p_months))
          AND (p_days IS NULL OR array_length(p_days, 1) IS NULL OR EXTRACT(DAY FROM fecha_cod)::INT = ANY(p_days))
          AND (p_regions IS NULL OR array_length(p_regions, 1) IS NULL OR region = ANY(p_regions))
          AND (p_agencias IS NULL OR array_length(p_agencias, 1) IS NULL OR codigo_agencia = ANY(p_agencias))
        GROUP BY region
        ORDER BY value DESC
    ) t;

    -- Gráfico Estados
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_estados
    FROM (
        SELECT estado as id, SUM(total_asignaciones) as value
        FROM public.mv_dashboard_summary
        WHERE estado IS NOT NULL
          AND (p_years IS NULL OR array_length(p_years, 1) IS NULL OR anio = ANY(p_years))
          AND (p_months IS NULL OR array_length(p_months, 1) IS NULL OR mes = ANY(p_months))
          AND (p_days IS NULL OR array_length(p_days, 1) IS NULL OR EXTRACT(DAY FROM fecha_cod)::INT = ANY(p_days))
          AND (p_regions IS NULL OR array_length(p_regions, 1) IS NULL OR region = ANY(p_regions))
          AND (p_agencias IS NULL OR array_length(p_agencias, 1) IS NULL OR codigo_agencia = ANY(p_agencias))
        GROUP BY estado
        ORDER BY value DESC
    ) t;

    -- Retorno Limpio hacia Next.js
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


-- 3. FUNCIÓN RPC PARA EL PIVOT MENSUAL - V7 MULTI-SELECT
CREATE OR REPLACE FUNCTION public.fn_dashboard_monthly_pivot_v7(
    p_years INT[] DEFAULT NULL,
    p_regions TEXT[] DEFAULT NULL,
    p_agencias TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    mes INT,
    transaccion VARCHAR,
    total_asignaciones BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.mes,
        m.transaccion,
        SUM(m.total_asignaciones) AS total_asignaciones
    FROM public.mv_dashboard_summary m
    WHERE (p_years IS NULL OR array_length(p_years, 1) IS NULL OR m.anio = ANY(p_years))
      AND (p_regions IS NULL OR array_length(p_regions, 1) IS NULL OR m.region = ANY(p_regions))
      AND (p_agencias IS NULL OR array_length(p_agencias, 1) IS NULL OR m.codigo_agencia = ANY(p_agencias))
    GROUP BY m.mes, m.transaccion
    ORDER BY m.mes;
END;
$$ LANGUAGE plpgsql;
