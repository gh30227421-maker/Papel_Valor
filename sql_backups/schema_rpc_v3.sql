CREATE OR REPLACE FUNCTION public.fn_dashboard_stats_v3(
    p_year INT DEFAULT NULL,
    p_region VARCHAR DEFAULT NULL,
    p_agencia VARCHAR DEFAULT NULL
)
RETURNS json AS $$
DECLARE
    total_asignaciones bigint;
    promedio_diario numeric;
    transacciones json;
    top_agencias json;
    regiones json;
    estados json;
    
    -- Variables para optimización de fechas (Sargable)
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Determinar los rangos de fecha para usar los índices de forma rápida
    IF p_year IS NOT NULL THEN
        v_start_date := MAKE_DATE(p_year, 1, 1);
        v_end_date := MAKE_DATE(p_year, 12, 31);
    END IF;

    -- 1. Total y Promedio
    SELECT count(*), 
           count(*) / GREATEST((current_date - min(fecha_cod)), 1)
    INTO total_asignaciones, promedio_diario
    FROM vw_asignaciones_agencias
    WHERE (p_year IS NULL OR (fecha_cod >= v_start_date AND fecha_cod <= v_end_date))
      AND (p_region IS NULL OR p_region = 'Todas' OR agencia_region = p_region)
      AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia);

    -- 2. Transacciones (Solo Primera Vez, Reposición, Migraciones)
    SELECT json_agg(row_to_json(t)) INTO transacciones
    FROM (
        SELECT transaccion as name, count(*) as value
        FROM vw_asignaciones_agencias
        WHERE transaccion IN ('511', '518', '522', '570') 
          AND (p_year IS NULL OR (fecha_cod >= v_start_date AND fecha_cod <= v_end_date))
          AND (p_region IS NULL OR p_region = 'Todas' OR agencia_region = p_region)
          AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia)
        GROUP BY transaccion
    ) t;

    -- 3. Top 10 Agencias
    SELECT json_agg(row_to_json(t)) INTO top_agencias
    FROM (
        SELECT agencia_nombre as name, count(*) as value
        FROM vw_asignaciones_agencias
        WHERE agencia_nombre IS NOT NULL
          AND (p_year IS NULL OR (fecha_cod >= v_start_date AND fecha_cod <= v_end_date))
          AND (p_region IS NULL OR p_region = 'Todas' OR agencia_region = p_region)
          AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia)
        GROUP BY agencia_nombre
        ORDER BY value DESC
        LIMIT 10
    ) t;

    -- 4. Regiones
    SELECT json_agg(row_to_json(t)) INTO regiones
    FROM (
        SELECT agencia_region as name, count(*) as value
        FROM vw_asignaciones_agencias
        WHERE agencia_region IS NOT NULL
          AND (p_year IS NULL OR (fecha_cod >= v_start_date AND fecha_cod <= v_end_date))
          AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia)
        GROUP BY agencia_region
        ORDER BY value DESC
    ) t;

    -- 5. Estados 
    SELECT json_agg(row_to_json(t)) INTO estados
    FROM (
        SELECT agencia_estado as id, count(*) as value
        FROM vw_asignaciones_agencias
        WHERE agencia_estado IS NOT NULL
          AND (p_year IS NULL OR (fecha_cod >= v_start_date AND fecha_cod <= v_end_date))
          AND (p_region IS NULL OR p_region = 'Todas' OR agencia_region = p_region)
          AND (p_agencia IS NULL OR p_agencia = '' OR codigo_agencia = p_agencia)
        GROUP BY agencia_estado
    ) t;

    RETURN json_build_object(
        'total', coalesce(total_asignaciones, 0),
        'promedio_diario', coalesce(round(promedio_diario, 0), 0),
        'transacciones', coalesce(transacciones, '[]'::json),
        'top_agencias', coalesce(top_agencias, '[]'::json),
        'regiones', coalesce(regiones, '[]'::json),
        'estados', coalesce(estados, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_get_filtros_basicos()
RETURNS json AS $$
DECLARE
    years json;
    regions json;
    agencias json;
BEGIN
    SELECT json_agg(DISTINCT EXTRACT(YEAR FROM fecha_cod)::text) INTO years
    FROM asignaciones_diarias;

    SELECT json_agg(row_to_json(a)) INTO agencias
    FROM (
        SELECT codigo, nombre, region 
        FROM agencias 
        ORDER BY nombre
    ) a;

    SELECT json_agg(DISTINCT region) INTO regions
    FROM agencias
    WHERE region IS NOT NULL;

    RETURN json_build_object(
        'years', coalesce(years, '[]'::json),
        'regions', coalesce(regions, '[]'::json),
        'agencias', coalesce(agencias, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql;
