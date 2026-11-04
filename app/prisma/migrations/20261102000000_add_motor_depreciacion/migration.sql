-- Sub-módulo 03: Motor de Depreciación y Contabilización DGII
-- Incluye: cuenta de gasto por depreciación (TipoActivo), períodos, detalle y asientos contables.

-- ============================================================
-- 1) TipoActivo: cuenta contable de gasto por depreciación (débito)
-- ============================================================
ALTER TABLE "tipos_activos" ADD COLUMN "cuenta_contable_gasto_depreciacion" VARCHAR(20);

UPDATE "tipos_activos"
SET "cuenta_contable_gasto_depreciacion" = CASE "metodo_depreciacion"
  WHEN 'DGII_CAT1' THEN '6-30-01-0001'
  WHEN 'DGII_CAT2' THEN '6-30-01-0002'
  WHEN 'DGII_CAT3' THEN '6-30-01-0003'
  ELSE '6-30-01-0002'
END
WHERE "cuenta_contable_gasto_depreciacion" IS NULL;

CREATE INDEX "tipos_activos_cuenta_gasto_idx" ON "tipos_activos"("cuenta_contable_gasto_depreciacion");

-- ============================================================
-- 2) Períodos de depreciación
-- ============================================================
CREATE TABLE "periodos_depreciacion" (
  "id" VARCHAR(36) NOT NULL,
  "anio" INTEGER NOT NULL,
  "mes" INTEGER NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
  "fecha_corte" DATE NOT NULL,
  "total_activos" INTEGER NOT NULL DEFAULT 0,
  "total_cuota" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  "activos_omitidos" INTEGER NOT NULL DEFAULT 0,
  "activos_excluidos" INTEGER NOT NULL DEFAULT 0,
  "fecha_ejecucion" TIMESTAMPTZ,
  "ejecutado_por_id" VARCHAR(36),
  "fecha_cierre" TIMESTAMPTZ,
  "cerrado_por_id" VARCHAR(36),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "periodos_depreciacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "periodos_depreciacion_anio_mes_key" UNIQUE ("anio", "mes"),
  CONSTRAINT "periodos_depreciacion_anio_check" CHECK ("anio" BETWEEN 2000 AND 2100),
  CONSTRAINT "periodos_depreciacion_mes_check" CHECK ("mes" BETWEEN 1 AND 12),
  CONSTRAINT "periodos_depreciacion_estado_check" CHECK ("estado" IN ('ABIERTO','CALCULADO','CERRADO')),
  CONSTRAINT "periodos_depreciacion_cierre_check" CHECK ("fecha_cierre" IS NULL OR "estado" = 'CERRADO'),
  CONSTRAINT "periodos_depreciacion_ejecutado_fk" FOREIGN KEY ("ejecutado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "periodos_depreciacion_cerrado_fk" FOREIGN KEY ("cerrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "periodos_depreciacion_estado_idx" ON "periodos_depreciacion"("estado");
CREATE INDEX "periodos_depreciacion_ejecutado_por_id_idx" ON "periodos_depreciacion"("ejecutado_por_id");

-- ============================================================
-- 3) Detalle de depreciación por activo y período
-- ============================================================
CREATE TABLE "detalle_depreciacion" (
  "id" VARCHAR(36) NOT NULL,
  "periodo_id" VARCHAR(36) NOT NULL,
  "activo_id" VARCHAR(36) NOT NULL,
  "cuota_mensual" DECIMAL(14,2) NOT NULL,
  "depreciacion_acumulada_anterior" DECIMAL(14,2) NOT NULL,
  "depreciacion_acumulada_nueva" DECIMAL(14,2) NOT NULL,
  "valor_en_libros_anterior" DECIMAL(14,2) NOT NULL,
  "valor_en_libros_nuevo" DECIMAL(14,2) NOT NULL,
  "tipo_cuota" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  "es_cuota_final" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "detalle_depreciacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "detalle_depreciacion_periodo_activo_key" UNIQUE ("periodo_id", "activo_id"),
  CONSTRAINT "detalle_depreciacion_cuota_check" CHECK ("cuota_mensual" >= 0),
  CONSTRAINT "detalle_depreciacion_tipo_cuota_check" CHECK ("tipo_cuota" IN ('NORMAL','ULTIMA','NO_DEPRECIABLE')),
  CONSTRAINT "detalle_depreciacion_valor_check" CHECK ("valor_en_libros_nuevo" = "valor_en_libros_anterior" - "cuota_mensual"),
  CONSTRAINT "detalle_depreciacion_periodo_fk" FOREIGN KEY ("periodo_id") REFERENCES "periodos_depreciacion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "detalle_depreciacion_activo_fk" FOREIGN KEY ("activo_id") REFERENCES "activos_fijos"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "detalle_depreciacion_activo_idx" ON "detalle_depreciacion"("activo_id");
CREATE INDEX "detalle_depreciacion_periodo_idx" ON "detalle_depreciacion"("periodo_id");

-- ============================================================
-- 4) Asientos contables consolidados
-- ============================================================
CREATE TABLE "asientos_contables" (
  "id" VARCHAR(36) NOT NULL,
  "numero_asiento" VARCHAR(20) NOT NULL,
  "periodo_id" VARCHAR(36) NOT NULL,
  "concepto" VARCHAR(150) NOT NULL,
  "fecha_contable" DATE NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE_ENVIO',
  "total_debito" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  "total_credito" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "asientos_contables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "asientos_contables_numero_asiento_key" UNIQUE ("numero_asiento"),
  CONSTRAINT "asientos_contables_periodo_id_key" UNIQUE ("periodo_id"),
  CONSTRAINT "asientos_contables_estado_check" CHECK ("estado" IN ('PENDIENTE_ENVIO','ENVIADO','ERROR')),
  CONSTRAINT "asientos_contables_balance_check" CHECK ("total_debito" = "total_credito"),
  CONSTRAINT "asientos_contables_periodo_fk" FOREIGN KEY ("periodo_id") REFERENCES "periodos_depreciacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "asientos_contables_estado_idx" ON "asientos_contables"("estado");

-- ============================================================
-- 5) Líneas de asiento contable
-- ============================================================
CREATE TABLE "lineas_asiento" (
  "id" VARCHAR(36) NOT NULL,
  "asiento_id" VARCHAR(36) NOT NULL,
  "cuenta_contable" VARCHAR(20) NOT NULL,
  "tipo_movimiento" VARCHAR(10) NOT NULL,
  "monto" DECIMAL(14,2) NOT NULL,
  "descripcion" VARCHAR(150) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "lineas_asiento_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lineas_asiento_cuenta_check" CHECK ("cuenta_contable" ~ '^[1-9]-[0-9]{2}-[0-9]{2}-[0-9]{4}$'),
  CONSTRAINT "lineas_asiento_movimiento_check" CHECK ("tipo_movimiento" IN ('DEBITO','CREDITO')),
  CONSTRAINT "lineas_asiento_monto_check" CHECK ("monto" >= 0),
  CONSTRAINT "lineas_asiento_asiento_fk" FOREIGN KEY ("asiento_id") REFERENCES "asientos_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "lineas_asiento_asiento_id_idx" ON "lineas_asiento"("asiento_id");
