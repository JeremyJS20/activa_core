-- CreateTable
CREATE TABLE "departamentos" (
    "id" VARCHAR(36) NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "descripcion" VARCHAR(120) NOT NULL,
    "responsable_id" VARCHAR(36),
    "estado" VARCHAR(10) NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_activos" (
    "id" VARCHAR(36) NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "descripcion" VARCHAR(150) NOT NULL,
    "cuenta_contable_compra" VARCHAR(20) NOT NULL,
    "cuenta_contable_depreciacion" VARCHAR(20) NOT NULL,
    "metodo_depreciacion" VARCHAR(20) NOT NULL DEFAULT 'LINEA_RECTA',
    "porcentaje_depreciacion_anual" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "vida_util_meses" INTEGER NOT NULL DEFAULT 12,
    "estado" VARCHAR(10) NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tipos_activos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" VARCHAR(36) NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "apellido" VARCHAR(100) NOT NULL,
    "tipo_persona" VARCHAR(10) NOT NULL DEFAULT 'FISICA',
    "cedula" VARCHAR(15) NOT NULL,
    "departamento_id" VARCHAR(36) NOT NULL,
    "cargo" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(150),
    "telefono" VARCHAR(20),
    "fecha_ingreso" DATE NOT NULL,
    "estado" VARCHAR(10) NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_codigo_key" ON "departamentos"("codigo");

-- CreateIndex
CREATE INDEX "departamentos_codigo_idx" ON "departamentos"("codigo");

-- CreateIndex
CREATE INDEX "departamentos_estado_idx" ON "departamentos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_activos_codigo_key" ON "tipos_activos"("codigo");

-- CreateIndex
CREATE INDEX "tipos_activos_codigo_idx" ON "tipos_activos"("codigo");

-- CreateIndex
CREATE INDEX "tipos_activos_estado_idx" ON "tipos_activos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_codigo_key" ON "empleados"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_cedula_key" ON "empleados"("cedula");

-- CreateIndex
CREATE INDEX "empleados_codigo_idx" ON "empleados"("codigo");

-- CreateIndex
CREATE INDEX "empleados_cedula_idx" ON "empleados"("cedula");

-- CreateIndex
CREATE INDEX "empleados_departamento_id_idx" ON "empleados"("departamento_id");

-- CreateIndex
CREATE INDEX "empleados_estado_idx" ON "empleados"("estado");

-- CreateIndex
CREATE INDEX "usuarios_empleado_id_idx" ON "usuarios"("empleado_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departamentos" ADD CONSTRAINT "departamentos_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
