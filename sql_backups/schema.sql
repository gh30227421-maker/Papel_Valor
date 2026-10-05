-- Habilitar extensión requerida (gen_random_uuid() viene nativo en PG 13+, pero no está de más asegurarnos)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Tabla: agencias
-- ==========================================
CREATE TABLE IF NOT EXISTS public.agencias (
    codigo VARCHAR(15) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    region VARCHAR(50) NOT NULL,
    estado VARCHAR(50),
    zona VARCHAR(50) NOT NULL,
    gerente VARCHAR(100),
    estatus VARCHAR(20) DEFAULT 'Activa'
);

-- ==========================================
-- 2. Tabla: despachos (Módulo de Lotes / Histórico)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.despachos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha_despacho DATE NOT NULL,
    codigo_agencia VARCHAR(15),
    correlativo_inicial VARCHAR(30) NOT NULL,
    correlativo_final VARCHAR(30) NOT NULL,
    cantidad INT NOT NULL,
    elaborador VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. Tabla: asignaciones_diarias (Carga masiva diaria por cliente)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.asignaciones_diarias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha_cod DATE NOT NULL,
    transaccion VARCHAR(10),
    detalle_tra VARCHAR(100),
    tipo_tdd VARCHAR(50),
    codigo_agencia VARCHAR(15),
    tdd_nueva VARCHAR(30),
    tdd_vieja VARCHAR(30)
);

-- ==========================================
-- 4. Tabla: stock_actual (Inventario físico diario por agencia)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.stock_actual (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo_agencia VARCHAR(15),
    tipo VARCHAR(50),
    correlativo VARCHAR(30),
    -- NOTA: Sugiero agregar un campo para la cantidad, por ejemplo:
    -- cantidad INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 5. Tabla: metas_agencias (Objetivos mensuales por agencia)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.metas_agencias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo_agencia VARCHAR(15),
    mes VARCHAR(20),
    anio INT,
    meta_cantidad INT
);

-- ==========================================
-- OPCIONAL: Políticas de Seguridad (RLS)
-- Supabase habilita RLS por defecto en la UI. Si tu app web consumirá estos
-- datos mediante la anon_key, necesitas políticas para poder leer/escribir.
-- A continuación, habilitamos lectura completa y escritura completa para desarrollo:
-- ==========================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.agencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_diarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_actual ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_agencias ENABLE ROW LEVEL SECURITY;

-- Crear políticas permisivas (CUIDADO: Esto es para desarrollo. En producción deberías restringirlo).
CREATE POLICY "Permitir todo a anon en agencias" ON public.agencias FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en despachos" ON public.despachos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en asignaciones_diarias" ON public.asignaciones_diarias FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en stock_actual" ON public.stock_actual FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo a anon en metas_agencias" ON public.metas_agencias FOR ALL TO anon USING (true) WITH CHECK (true);
