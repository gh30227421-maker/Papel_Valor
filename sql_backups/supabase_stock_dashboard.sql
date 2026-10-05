-- =========================================================================================
-- FUNCIÓN: fn_stock_dashboard_v2
-- Descripción: Calcula KPIs de Stock y PROYECCIÓN de autonomía cruzando inventario y ventas.
-- =========================================================================================

CREATE OR REPLACE FUNCTION public.fn_stock_dashboard_v2(p_region VARCHAR DEFAULT NULL)
RETURNS json AS $$
DECLARE
    v_boveda INT := 0;
    v_nomina INT := 0;
    v_agencias INT := 0;
    v_global INT := 0;
    v_top_agencias JSON;
    v_regiones JSON;
    v_estados JSON;
    v_proyeccion JSON;
BEGIN
    -- 1. KPIs Globales
    SELECT 
        COUNT(s.id) FILTER (WHERE s.codigo_agencia = '95'),
        COUNT(s.id) FILTER (WHERE s.codigo_agencia = '743'),
        COUNT(s.id) FILTER (WHERE s.codigo_agencia NOT IN ('95', '743')),
        COUNT(s.id)
    INTO 
        v_boveda, v_nomina, v_agencias, v_global
    FROM public.stock_actual s
    LEFT JOIN public.agencias ag ON s.codigo_agencia = ag.codigo
    WHERE (p_region IS NULL OR p_region = '' OR p_region = 'TODAS' OR ag.region = p_region);

    -- 2. Top 10 Agencias con mayor stock (Excluyendo Bóveda y Nómina)
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_top_agencias
    FROM (
        SELECT ag.nombre as name, COUNT(s.id) as value
        FROM public.stock_actual s
        LEFT JOIN public.agencias ag ON s.codigo_agencia = ag.codigo
        WHERE s.codigo_agencia NOT IN ('95', '743') AND ag.nombre IS NOT NULL
          AND (p_region IS NULL OR p_region = '' OR p_region = 'TODAS' OR ag.region = p_region)
        GROUP BY ag.nombre
        ORDER BY value DESC
        LIMIT 10
    ) t;

    -- 3. Distribución por Región (Excluyendo Bóveda y Nómina)
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_regiones
    FROM (
        SELECT ag.region as name, COUNT(s.id) as value
        FROM public.stock_actual s
        LEFT JOIN public.agencias ag ON s.codigo_agencia = ag.codigo
        WHERE s.codigo_agencia NOT IN ('95', '743') AND ag.region IS NOT NULL
          AND (p_region IS NULL OR p_region = '' OR p_region = 'TODAS' OR ag.region = p_region)
        GROUP BY ag.region
        ORDER BY value DESC
    ) t;

    -- 4. Distribución por Estado (Excluyendo Bóveda y Nómina)
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_estados
    FROM (
        SELECT ag.estado as id, COUNT(s.id) as value
        FROM public.stock_actual s
        LEFT JOIN public.agencias ag ON s.codigo_agencia = ag.codigo
        WHERE s.codigo_agencia NOT IN ('95', '743') AND ag.estado IS NOT NULL
          AND (p_region IS NULL OR p_region = '' OR p_region = 'TODAS' OR ag.region = p_region)
        GROUP BY ag.estado
        ORDER BY value DESC
    ) t;

    -- 5. Proyección y Autonomía de Inventario (Cruce)
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_proyeccion
    FROM (
        WITH historico AS (
            -- Promedios basados en las asignaciones de la vista materializada
            SELECT 
                codigo_agencia,
                SUM(total_asignaciones) as total_historico,
                COUNT(DISTINCT fecha_cod) as dias_operativos
            FROM public.mv_dashboard_summary
            GROUP BY codigo_agencia
        ),
        inventario AS (
            -- Inventario actual por agencia
            SELECT s.codigo_agencia, ag.nombre, ag.region, ag.zona, COUNT(s.id) as stock_actual
            FROM public.stock_actual s
            JOIN public.agencias ag ON s.codigo_agencia = ag.codigo
            WHERE s.codigo_agencia NOT IN ('95', '743')
              AND (p_region IS NULL OR p_region = '' OR p_region = 'TODAS' OR ag.region = p_region)
            GROUP BY s.codigo_agencia, ag.nombre, ag.region, ag.zona
        )
        SELECT 
            i.codigo_agencia,
            i.nombre AS agencia,
            i.region,
            i.zona,
            i.stock_actual,
            COALESCE(ROUND(h.total_historico::numeric / NULLIF(h.dias_operativos, 0), 0), 0)::INT AS prom_diario,
            COALESCE(ROUND((h.total_historico::numeric / NULLIF(h.dias_operativos, 0)) * 30 * 1.2, 0), 0)::INT AS meta_sugerida,
            CASE 
                WHEN COALESCE(ROUND(h.total_historico::numeric / NULLIF(h.dias_operativos, 0), 0), 0) = 0 THEN 999
                ELSE ROUND(i.stock_actual::numeric / (h.total_historico::numeric / NULLIF(h.dias_operativos, 0)), 0)::INT
            END AS dias_stock
        FROM inventario i
        LEFT JOIN historico h ON i.codigo_agencia = h.codigo_agencia
        ORDER BY dias_stock ASC -- Al principio las de mayor urgencia
    ) t;

    RETURN json_build_object(
        'stock_boveda', v_boveda,
        'stock_nomina', v_nomina,
        'stock_agencias', v_agencias,
        'stock_global', v_global,
        'top_agencias', v_top_agencias,
        'regiones', v_regiones,
        'estados', v_estados,
        'proyeccion', v_proyeccion
    );
END;
$$ LANGUAGE plpgsql;
