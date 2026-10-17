-- CreateTable
CREATE TABLE "activos_fijos" (
    "id" VARCHAR(36) NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255) NOT NULL,
    "tipo_activo_id" VARCHAR(36) NOT NULL,
    "departamento_id" VARCHAR(36) NOT NULL,
    "empleado_id" VARCHAR(36) NOT NULL,
    "fecha_adquisicion" DATE NOT NULL,
    "costo_adquisicion" DECIMAL(14,2) NOT NULL,
    "valor_residual" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "depreciacion_acumulada" DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    "valor_en_libros" DECIMAL(14,2) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    "marca" VARCHAR(100),
    "modelo" VARCHAR(100),
    "numero_serie" VARCHAR(100),
    "ubicacion_fisica" VARCHAR(255),
    "color" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "activos_fijos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_custodia" (
    "id" VARCHAR(36) NOT NULL,
    "activo_id" VARCHAR(36) NOT NULL,
    "empleado_anterior_id" VARCHAR(36),
    "empleado_nuevo_id" VARCHAR(36) NOT NULL,
    "departamento_anterior_id" VARCHAR(36),
    "departamento_nuevo_id" VARCHAR(36) NOT NULL,
    "motivo" VARCHAR(30) NOT NULL,
    "justificacion" TEXT NOT NULL,
    "autorizado_por_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_custodia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_bajas" (
    "id" VARCHAR(36) NOT NULL,
    "activo_id" VARCHAR(36) NOT NULL,
    "motivo_baja" VARCHAR(30) NOT NULL,
    "justificacion" TEXT NOT NULL,
    "numero_acta" VARCHAR(50) NOT NULL,
    "fecha_baja" DATE NOT NULL,
    "valor_en_libros_al_baja" DECIMAL(14,2) NOT NULL,
    "autorizado_por_id" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_bajas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activos_fijos_codigo_key" ON "activos_fijos"("codigo");

-- CreateIndex
CREATE INDEX "activos_fijos_codigo_idx" ON "activos_fijos"("codigo");

-- CreateIndex
CREATE INDEX "activos_fijos_departamento_id_idx" ON "activos_fijos"("departamento_id");

-- CreateIndex
CREATE INDEX "activos_fijos_empleado_id_idx" ON "activos_fijos"("empleado_id");

-- CreateIndex
CREATE INDEX "activos_fijos_tipo_activo_id_idx" ON "activos_fijos"("tipo_activo_id");

-- CreateIndex
CREATE INDEX "activos_fijos_estado_idx" ON "activos_fijos"("estado");

-- CreateIndex
CREATE INDEX "activos_fijos_numero_serie_idx" ON "activos_fijos"("numero_serie");

-- CreateIndex
CREATE INDEX "historial_custodia_activo_id_created_at_idx" ON "historial_custodia"("activo_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "historial_bajas_activo_id_key" ON "historial_bajas"("activo_id");

-- CreateIndex
CREATE INDEX "historial_bajas_activo_id_idx" ON "historial_bajas"("activo_id");

-- AddForeignKey
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_tipo_activo_id_fkey" FOREIGN KEY ("tipo_activo_id") REFERENCES "tipos_activos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activos_fijos" ADD CONSTRAINT "activos_fijos_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_custodia" ADD CONSTRAINT "historial_custodia_activo_id_fkey" FOREIGN KEY ("activo_id") REFERENCES "activos_fijos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_custodia" ADD CONSTRAINT "historial_custodia_empleado_anterior_id_fkey" FOREIGN KEY ("empleado_anterior_id") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_custodia" ADD CONSTRAINT "historial_custodia_empleado_nuevo_id_fkey" FOREIGN KEY ("empleado_nuevo_id") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_custodia" ADD CONSTRAINT "historial_custodia_departamento_anterior_id_fkey" FOREIGN KEY ("departamento_anterior_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_custodia" ADD CONSTRAINT "historial_custodia_departamento_nuevo_id_fkey" FOREIGN KEY ("departamento_nuevo_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_custodia" ADD CONSTRAINT "historial_custodia_autorizado_por_id_fkey" FOREIGN KEY ("autorizado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_bajas" ADD CONSTRAINT "historial_bajas_activo_id_fkey" FOREIGN KEY ("activo_id") REFERENCES "activos_fijos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_bajas" ADD CONSTRAINT "historial_bajas_autorizado_por_id_fkey" FOREIGN KEY ("autorizado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
