-- Función para obtener los totales de distribución del mes actual y mes anterior sin límite de registros.
-- Puedes ejecutar esto en el SQL Editor de Supabase.

CREATE OR REPLACE FUNCTION get_monthly_dispatch_metrics()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_month_total bigint := 0;
  v_prev_month_total bigint := 0;
  v_current_month int;
  v_current_year int;
  v_prev_month int;
  v_prev_year int;
BEGIN
  -- Obtener mes y año actuales
  v_current_month := extract(month from current_date);
  v_current_year := extract(year from current_date);
  
  -- Calcular mes y año anterior
  IF v_current_month = 1 THEN
    v_prev_month := 12;
    v_prev_year := v_current_year - 1;
  ELSE
    v_prev_month := v_current_month - 1;
    v_prev_year := v_current_year;
  END IF;

  -- Sumar cantidades del mes actual
  SELECT COALESCE(SUM(cantidad), 0) INTO v_current_month_total
  FROM despachos
  WHERE extract(month from fecha_despacho::date) = v_current_month
    AND extract(year from fecha_despacho::date) = v_current_year;

  -- Sumar cantidades del mes anterior
  SELECT COALESCE(SUM(cantidad), 0) INTO v_prev_month_total
  FROM despachos
  WHERE extract(month from fecha_despacho::date) = v_prev_month
    AND extract(year from fecha_despacho::date) = v_prev_year;

  RETURN json_build_object(
    'volumenMesActual', v_current_month_total,
    'volumenMesAnterior', v_prev_month_total
  );
END;
$$;
