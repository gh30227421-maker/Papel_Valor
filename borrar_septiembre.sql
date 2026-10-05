-- 1. Borrar todas las asignaciones del mes de Septiembre del año 2026
DELETE FROM public.asignaciones_diarias
WHERE fecha_cod >= '2026-09-01' AND fecha_cod < '2026-10-01';

-- 2. Refrescar el Dashboard para que los gráficos y métricas queden en cero o bajen 
-- y reflejen que esos datos ya no existen.
REFRESH MATERIALIZED VIEW public.mv_dashboard_summary;
