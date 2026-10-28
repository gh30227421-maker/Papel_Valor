-- =========================================================================================
-- MIGRACIÓN: Sistema de Stock en Custodia Física (Bóveda Transitoria)
-- Descripción: Permite reflejar lotes físicos recibidos en custodia que aún no se han 
--              cargado serial por serial en stock_actual, sumándolos a Bóveda Central.
-- =========================================================================================

-- 1. CREACIÓN DE LA TABLA DE CUSTODIA
CREATE TABLE IF NOT EXISTS public.stock_custodia (
    id SERIAL PRIMARY KEY,
    concepto VARCHAR(150) NOT NULL DEFAULT 'Custodia Bóveda Central (Lote Físico)',
    cantidad INT NOT NULL DEFAULT 0,
    observaciones TEXT,
    actualizado_por VARCHAR(100) DEFAULT 'Operaciones BNC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. INSERCIÓN DE REGISTRO INICIAL POR DEFECTO SI NO EXISTE
INSERT INTO public.stock_custodia (id, concepto, cantidad, observaciones, actualizado_por)
VALUES (1, 'Custodia Bóveda Central (Lote Físico)', 0, 'Lote inicial de custodia', 'Sistema')
ON CONFLICT (id) DO NOTHING;

-- 3. HABILITACIÓN DE RLS Y POLÍTICAS DE ACCESO
ALTER TABLE public.stock_custodia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica o autenticada de custodia" ON public.stock_custodia;
CREATE POLICY "Permitir lectura publica o autenticada de custodia" 
ON public.stock_custodia FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Permitir actualizacion de custodia a usuarios autenticados" ON public.stock_custodia;
CREATE POLICY "Permitir actualizacion de custodia a usuarios autenticados" 
ON public.stock_custodia FOR ALL 
USING (true)
WITH CHECK (true);

-- 4. FUNCIÓN ACTUALIZADA: fn_stock_dashboard_v2 (Suma Bóveda en Sistema + Custodia)
CREATE OR REPLACE FUNCTION public.fn_stock_dashboard_v2(p_region VARCHAR DEFAULT NULL)
RETURNS json AS $$
DECLARE
    v_boveda_sistema INT := 0;
    v_custodia INT := 0;
    v_boveda INT := 0;
    v_nomina INT := 0;
    v_agencias INT := 0;
    v_global INT := 0;
    v_top_agencias JSON;
    v_regiones JSON;
    v_estados JSON;
    v_proyeccion JSON;
BEGIN
    -- A. Obtener stock en custodia física registrado
    BEGIN
        SELECT COALESCE(SUM(cantidad), 0) INTO v_custodia 
        FROM public.stock_custodia;
    EXCEPTION WHEN OTHERS THEN
        v_custodia := 0;
    END;

    -- B. KPIs Globales en Sistema (stock_actual)
    SELECT 
        COUNT(s.id) FILTER (WHERE s.codigo_agencia = '95'),
        COUNT(s.id) FILTER (WHERE s.codigo_agencia = '743'),
        COUNT(s.id) FILTER (WHERE s.codigo_agencia NOT IN ('95', '743')),
        COUNT(s.id)
    INTO 
        v_boveda_sistema, v_nomina, v_agencias, v_global
    FROM public.stock_actual s
    LEFT JOIN public.agencias ag ON s.codigo_agencia = ag.codigo
    WHERE (p_region IS NULL OR p_region = '' OR p_region = 'TODAS' OR ag.region = p_region);

    -- C. Consolidación: Si la consulta es a nivel nacional o sin filtro,
    -- sumar la custodia a Bóveda Central y al Stock Total Global.
    IF (p_region IS NULL OR p_region = '' OR p_region = 'TODAS') THEN
        v_boveda := v_boveda_sistema + v_custodia;
        v_global := v_global + v_custodia;
    ELSE
        v_boveda := v_boveda_sistema;
    END IF;

    -- D. Top 10 Agencias con mayor stock (Excluyendo Bóveda y Nómina)
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

    -- E. Distribución por Región (Excluyendo Bóveda y Nómina)
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

    -- F. Distribución por Estado (Excluyendo Bóveda y Nómina)
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

    -- G. Proyección y Autonomía de Inventario (Cruce)
    SELECT COALESCE(json_agg(row_to_json(t)), '[]') INTO v_proyeccion
    FROM (
        WITH historico AS (
            SELECT 
                codigo_agencia,
                SUM(total_asignaciones) as total_historico,
                COUNT(DISTINCT fecha_cod) as dias_operativos
            FROM public.mv_dashboard_summary
            GROUP BY codigo_agencia
        ),
        inventario AS (
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
        ORDER BY dias_stock ASC
    ) t;

    -- H. Retorno con todos los campos
    RETURN json_build_object(
        'stock_boveda', v_boveda,
        'stock_boveda_sistema', v_boveda_sistema,
        'stock_custodia', v_custodia,
        'stock_nomina', v_nomina,
        'stock_agencias', v_agencias,
        'stock_global', v_global,
        'top_agencias', v_top_agencias,
        'regiones', v_regiones,
        'estados', v_estados,
        'proyeccion', v_proyeccion
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
