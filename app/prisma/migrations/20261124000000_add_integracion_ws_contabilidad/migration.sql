-- Sub-módulo 05 — Integración Contable y Web Service Contabilidad
-- Migración aditiva: campos de respuesta WS, bitácora append-only y triggers.
-- No altera estados ni CHECK existentes de Sub-03.

ALTER TABLE "asientos_contables"
  ADD COLUMN "transaccion_ws_id" VARCHAR(60),
  ADD COLUMN "codigo_respuesta_ws" VARCHAR(10),
  ADD COLUMN "mensaje_respuesta_ws" VARCHAR(500),
  ADD COLUMN "fecha_envio_ws" TIMESTAMPTZ,
  ADD COLUMN "intentos_envio" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "asientos_contables"
  ADD CONSTRAINT "asientos_contables_intentos_envio_check" CHECK ("intentos_envio" >= 0);

CREATE INDEX "asientos_contables_estado_fecha_idx"
  ON "asientos_contables" ("estado", "fecha_contable" DESC);

CREATE TABLE "bitacora_envio_ws" (
  "id" VARCHAR(36) NOT NULL,
  "asiento_id" VARCHAR(36) NOT NULL,
  "numero_asiento" VARCHAR(20) NOT NULL,
  "usuario_id" VARCHAR(36) NOT NULL,
  "correo_usuario" VARCHAR(255) NOT NULL,
  "intento" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "endpoint" VARCHAR(500) NOT NULL,
  "http_status" INTEGER,
  "respuesta" JSONB,
  "mensaje" VARCHAR(1000),
  "duracion_ms" INTEGER NOT NULL,
  "resultado" VARCHAR(20) NOT NULL,
  "correlation_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "bitacora_envio_ws_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bitacora_envio_ws_intento_check" CHECK ("intento" > 0),
  CONSTRAINT "bitacora_envio_ws_duracion_check" CHECK ("duracion_ms" >= 0),
  CONSTRAINT "bitacora_envio_ws_resultado_check"
    CHECK ("resultado" IN ('EXITOSO','RECHAZADO','ERROR_RED','TIMEOUT','RECONCILIADO')),
  CONSTRAINT "bitacora_envio_ws_asiento_fk"
    FOREIGN KEY ("asiento_id") REFERENCES "asientos_contables"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bitacora_envio_ws_usuario_fk"
    FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "bitacora_envio_ws_asiento_intento_key"
  ON "bitacora_envio_ws" ("asiento_id", "intento");
CREATE INDEX "bitacora_envio_ws_asiento_created_idx"
  ON "bitacora_envio_ws" ("asiento_id", "created_at" DESC);
CREATE INDEX "bitacora_envio_ws_resultado_created_idx"
  ON "bitacora_envio_ws" ("resultado", "created_at" DESC);
CREATE INDEX "bitacora_envio_ws_correlation_idx"
  ON "bitacora_envio_ws" ("correlation_id");

-- Append-only a nivel de base (defensa en profundidad).
CREATE OR REPLACE FUNCTION "prevent_bitacora_envio_ws_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bitacora_envio_ws es append-only: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bitacora_envio_ws_no_update_delete"
  BEFORE UPDATE OR DELETE ON "bitacora_envio_ws"
  FOR EACH ROW EXECUTE FUNCTION "prevent_bitacora_envio_ws_mutation"();
