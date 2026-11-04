-- Sub-módulo 03: bitácora de auditoría de corridas y cierres de depreciación
CREATE TABLE "auditoria" (
  "id" VARCHAR(36) NOT NULL,
  "usuario_id" VARCHAR(36),
  "accion" VARCHAR(40) NOT NULL,
  "recurso" VARCHAR(60) NOT NULL,
  "recurso_id" VARCHAR(36),
  "detalle" JSONB,
  "ip_address" VARCHAR(45),
  "user_agent" VARCHAR(255),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_accion_idx" ON "auditoria"("accion");
CREATE INDEX "auditoria_recurso_id_idx" ON "auditoria"("recurso_id");
CREATE INDEX "auditoria_usuario_id_idx" ON "auditoria"("usuario_id");
