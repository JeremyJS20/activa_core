-- CreateTable
CREATE TABLE "depreciaciones_mensual" (
    "id" VARCHAR(36) NOT NULL,
    "activo_id" VARCHAR(36) NOT NULL,
    "periodo_fiscal" CHAR(7) NOT NULL,
    "cuota_mes" DECIMAL(14,2) NOT NULL,
    "depreciacion_acumulada_post" DECIMAL(14,2) NOT NULL,
    "valor_en_libros_post" DECIMAL(14,2) NOT NULL,
    "cuenta_compra" VARCHAR(20) NOT NULL,
    "cuenta_depreciacion" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depreciaciones_mensual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacora_exportaciones" (
    "id" VARCHAR(36) NOT NULL,
    "usuario_id" VARCHAR(36) NOT NULL,
    "correo_usuario" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" VARCHAR(400),
    "formato" VARCHAR(10) NOT NULL,
    "reporte" VARCHAR(30) NOT NULL,
    "filtros_aplicados" JSONB NOT NULL,
    "filas_exportadas" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_exportaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "depreciaciones_mensual_periodo_fiscal_activo_id_idx" ON "depreciaciones_mensual"("periodo_fiscal", "activo_id");

-- CreateIndex
CREATE UNIQUE INDEX "depreciaciones_mensual_activo_id_periodo_fiscal_key" ON "depreciaciones_mensual"("activo_id", "periodo_fiscal");

-- CreateIndex
CREATE INDEX "bitacora_exportaciones_usuario_id_created_at_idx" ON "bitacora_exportaciones"("usuario_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activos_fijos_fecha_adquisicion_idx" ON "activos_fijos"("fecha_adquisicion");

-- CreateIndex
CREATE INDEX "activos_fijos_costo_adquisicion_idx" ON "activos_fijos"("costo_adquisicion");

-- AddForeignKey
ALTER TABLE "depreciaciones_mensual" ADD CONSTRAINT "depreciaciones_mensual_activo_id_fkey" FOREIGN KEY ("activo_id") REFERENCES "activos_fijos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_exportaciones" ADD CONSTRAINT "bitacora_exportaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
