-- =========================================================================================
-- OPTIMIZACIÓN EXTREMA: fn_dashboard_stats_v4
-- Descripción: Retorna métricas del dashboard en milisegundos utilizando tablas temporales
-- en memoria (TEMP TABLE) para recorrer los 700.000+ registros UNA SOLA VEZ, 
-- evitando 6 escaneos completos consecutivos que colapsaban la memoria.
-- =========================================================================================

-- 1. CREACIÓN DE ÍNDICES VITALES PARA ACELERAR BÚSQUEDAS EN TABLAS GIGANTES
CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha_cod ON public.asignaciones_diarias(fecha_cod);
CREATE INDEX IF NOT EXISTS idx_asignaciones_codigo_agencia ON public.asignaciones_diarias(codigo_agencia);
CREATE INDEX IF NOT EXISTS idx_asignaciones_transaccion ON public.asignaciones_diarias(transaccion);

-- 2. FUNCIÓN OPTIMIZADA
CREATE OR REPLACE FUNCTION public.fn_dashboard_stats_v4(
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
    -- PASO A: Crear una tabla temporal en memoria (muy rápida).
    -- Esto hace el JOIN y los FILTROS una sola vez sobre los cientos de miles de registros.
    CREATE TEMP TABLE tmp_dashboard_data ON COMMIT DROP AS
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
      AND a.transaccion IN ('511', '518', '522', '570')
      AND (p_year IS NULL OR EXTRACT(YEAR FROM a.fecha_cod) = p_year)
      AND (p_month IS NULL OR EXTRACT(MONTH FROM a.fecha_cod) = p_month)
      AND (p_region IS NULL OR ag.region = p_region)
      AND (p_agencia IS NULL OR a.codigo_agencia = p_agencia);

    -- PASO B: Calcular todas las métricas en fracciones de segundo utilizando la tabla filtrada (tmp_dashboard_data)

    -- 1. Total
    SELECT COUNT(id) INTO v_total FROM tmp_dashboard_data;

    -- 2. Promedio Diario
    SELECT COUNT(DISTINCT fecha_cod) INTO v_dias_operativos FROM tmp_dashboard_data;
    IF v_dias_operativos = 0 THEN v_dias_operativos := 1; END IF;
    v_promedio := ROUND((v_total::NUMERIC / v_dias_operativos), 0);

    -- 3. Transacciones
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_transacciones
    FROM (
        SELECT transaccion as name, COUNT(id) as value
        FROM tmp_dashboard_data
        GROUP BY transaccion
        ORDER BY value DESC
    ) t;

    -- 4. Top 10 Agencias
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_top_agencias
    FROM (
        SELECT agencia_nombre as name, COUNT(id) as value
        FROM tmp_dashboard_data
        WHERE agencia_nombre IS NOT NULL
        GROUP BY agencia_nombre
        ORDER BY value DESC
        LIMIT 10
    ) t;

    -- 5. Regiones
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_regiones
    FROM (
        SELECT region as name, COUNT(id) as value
        FROM tmp_dashboard_data
        WHERE region IS NOT NULL
        GROUP BY region
        ORDER BY value DESC
    ) t;

    -- 6. Estados
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_estados
    FROM (
        SELECT estado as id, COUNT(id) as value
        FROM tmp_dashboard_data
        WHERE estado IS NOT NULL
        GROUP BY estado
        ORDER BY value DESC
    ) t;

    -- Limpiar memoria explícitamente (aunque se borra al commit)
    DROP TABLE IF EXISTS tmp_dashboard_data;

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
