import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IntegrationError, type IntegrationErrorCode } from "@/lib/integracion/errors";
import { nuevaCorrelationId } from "@/lib/integracion/http";
import { construirPayloadAsiento, type TipoActivoContableInfo } from "@/lib/integracion/payload";
import {
  dispatchAsiento,
  type WsDispatchResult,
} from "@/lib/services/ws-contabilidad.client";

export interface UsuarioIntegracion {
  id: string;
  correo: string;
}

export interface DespachoResultado {
  asientoId: string;
  numeroAsiento: string;
  estado: "ENVIADO";
  transaccionWsId: string | null;
  codigoRespuestaWs: string;
  fechaEnvioWs: string | null;
  intento: number;
  duracionMs: number;
}

export interface LoteDespachoResultado {
  total: number;
  enviados: number;
  errores: number;
  restantes: number;
  resultados: Array<{
    asientoId: string;
    numeroAsiento: string;
    estado: "ENVIADO" | "ERROR";
    transaccionWsId?: string | null;
    codigo?: string;
    mensaje?: string;
  }>;
}

type ModoDespacho = "despachar" | "reintentar";

const WS_ERROR_CODES: ReadonlySet<string> = new Set<IntegrationErrorCode>([
  "WS_TIMEOUT",
  "WS_NETWORK_ERROR",
  "WS_REJECTED",
  "WS_SERVER_ERROR",
  "WS_DUPLICATE_UNCONFIRMED",
  "WS_INVALID_RESPONSE",
  "WS_CONFIG_ERROR",
]);

function errorDesdeResultadoWs(resultado: WsDispatchResult): IntegrationError {
  const code = (WS_ERROR_CODES.has(resultado.codigo) ? resultado.codigo : "WS_REJECTED") as IntegrationErrorCode;
  return new IntegrationError(code, resultado.mensaje, {
    endpoint: resultado.endpoint,
    httpStatus: resultado.httpStatus,
    duracionMs: resultado.duracionMs,
    resultado: resultado.resultado,
  });
}

function timeoutTransaccion(): number {
  const configurado = Number(process.env.WS_CONTABILIDAD_TIMEOUT_MS ?? 10_000);
  const base = Number.isFinite(configurado) && configurado > 0 ? configurado : 10_000;
  return base + 5_000;
}

async function tiposActivosContables(tx: Prisma.TransactionClient): Promise<TipoActivoContableInfo[]> {
  return tx.tipoActivo.findMany({
    where: { estado: "ACTIVO" },
    select: {
      codigo: true,
      cuentaContableGastoDepreciacion: true,
      cuentaContableDepreciacion: true,
      metodoDepreciacion: true,
    },
    orderBy: { codigo: "asc" },
  });
}

function validarEstado(asiento: { estado: string }, modo: ModoDespacho): void {
  if (asiento.estado === "ENVIADO") {
    throw new IntegrationError("ASIENTO_ALREADY_SENT");
  }
  if (modo === "despachar" && asiento.estado !== "PENDIENTE_ENVIO") {
    throw new IntegrationError(
      "ASIENTO_NOT_RETRYABLE",
      "Solo los asientos PENDIENTE_ENVIO pueden despacharse; use reintentar para un asiento en ERROR."
    );
  }
  if (modo === "reintentar" && asiento.estado !== "ERROR") {
    throw new IntegrationError(
      "ASIENTO_NOT_RETRYABLE",
      "Solo los asientos en ERROR pueden reintentarse."
    );
  }
}

async function ejecutarDespacho(
  asientoId: string,
  usuario: UsuarioIntegracion,
  modo: ModoDespacho
): Promise<{ resultado: WsDispatchResult; asiento: Record<string, unknown>; intento: number }> {
  return prisma.$transaction(
    async (tx) => {
      const inicial = await tx.asientoContable.findUnique({ where: { id: asientoId } });
      if (!inicial) throw new IntegrationError("ASIENTO_NOT_FOUND");

      // Serializa despachos concurrentes del mismo asiento hasta el COMMIT.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inicial.numeroAsiento})::bigint)`;

      const asiento = await tx.asientoContable.findUnique({
        where: { id: asientoId },
        include: { lineas: true, periodo: true },
      });
      if (!asiento) throw new IntegrationError("ASIENTO_NOT_FOUND");

      validarEstado(asiento, modo);

      const tipos = await tiposActivosContables(tx);
      const payload = construirPayloadAsiento(
        {
          numeroAsiento: asiento.numeroAsiento,
          concepto: asiento.concepto,
          fechaContable: asiento.fechaContable,
          estado: asiento.estado,
          totalDebito: asiento.totalDebito,
          totalCredito: asiento.totalCredito,
          lineas: asiento.lineas.map((linea) => ({
            cuentaContable: linea.cuentaContable,
            tipoMovimiento: linea.tipoMovimiento,
            monto: linea.monto,
            descripcion: linea.descripcion,
          })),
        },
        tipos
      );

      const correlationId = nuevaCorrelationId();
      const resultado = await dispatchAsiento(payload, { correlationId });
      const intento = asiento.intentosEnvio + 1;
      const fechaEnvioWs = new Date();

      const actualizado = await tx.asientoContable.update({
        where: { id: asiento.id },
        data: {
          estado: resultado.ok ? "ENVIADO" : "ERROR",
          transaccionWsId: resultado.transaccionWsId ?? asiento.transaccionWsId,
          codigoRespuestaWs: resultado.codigo,
          mensajeRespuestaWs: resultado.mensaje.slice(0, 500),
          fechaEnvioWs,
          intentosEnvio: intento,
        },
      });

      try {
        await tx.bitacoraEnvioWS.create({
          data: {
            asientoId: asiento.id,
            numeroAsiento: asiento.numeroAsiento,
            usuarioId: usuario.id,
            correoUsuario: usuario.correo,
            intento,
            payload: payload as unknown as Prisma.InputJsonValue,
            endpoint: resultado.endpoint,
            httpStatus: resultado.httpStatus,
            respuesta: (resultado.respuesta ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            mensaje: resultado.mensaje.slice(0, 1000),
            duracionMs: Math.max(0, Math.round(resultado.duracionMs)),
            resultado: resultado.resultado,
            correlationId: resultado.correlationId,
          },
        });
      } catch {
        // La transacción se revierte: nunca se marca ENVIADO sin bitácora.
        throw new IntegrationError("AUDIT_LOG_FAILED");
      }

      return { resultado, asiento: actualizado, intento };
    },
    { timeout: timeoutTransaccion(), maxWait: 5_000 }
  );
}

function resultadoExitoso(
  asiento: { id: string; numeroAsiento: string; fechaEnvioWs: Date | null; codigoRespuestaWs: string | null },
  resultado: WsDispatchResult,
  intento: number
): DespachoResultado {
  return {
    asientoId: asiento.id,
    numeroAsiento: asiento.numeroAsiento,
    estado: "ENVIADO",
    transaccionWsId: resultado.transaccionWsId ?? null,
    codigoRespuestaWs: asiento.codigoRespuestaWs ?? resultado.codigo,
    fechaEnvioWs: asiento.fechaEnvioWs ? asiento.fechaEnvioWs.toISOString() : null,
    intento,
    duracionMs: resultado.duracionMs,
  };
}

export async function despacharAsiento(
  asientoId: string,
  usuario: UsuarioIntegracion
): Promise<DespachoResultado> {
  const { resultado, asiento, intento } = await ejecutarDespacho(asientoId, usuario, "despachar");
  if (!resultado.ok) throw errorDesdeResultadoWs(resultado);

  return resultadoExitoso(
    asiento as {
      id: string;
      numeroAsiento: string;
      fechaEnvioWs: Date | null;
      codigoRespuestaWs: string | null;
    },
    resultado,
    intento
  );
}

export async function reintentarAsiento(
  asientoId: string,
  usuario: UsuarioIntegracion
): Promise<DespachoResultado> {
  const { resultado, asiento, intento } = await ejecutarDespacho(asientoId, usuario, "reintentar");
  if (!resultado.ok) throw errorDesdeResultadoWs(resultado);

  return resultadoExitoso(
    asiento as {
      id: string;
      numeroAsiento: string;
      fechaEnvioWs: Date | null;
      codigoRespuestaWs: string | null;
    },
    resultado,
    intento
  );
}

function filtroPeriodo(periodo?: string): Prisma.AsientoContableWhereInput {
  if (!periodo) return {};
  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) {
    throw new IntegrationError("VALIDATION_ERROR", "El período debe tener formato YYYY-MM.");
  }
  return { periodo: { anio, mes } };
}

export async function despacharPendientes(
  periodo: string | undefined,
  usuario: UsuarioIntegracion
): Promise<LoteDespachoResultado> {
  const where: Prisma.AsientoContableWhereInput = {
    estado: "PENDIENTE_ENVIO",
    ...filtroPeriodo(periodo),
  };

  let totalPendientes = 0;
  let pendientes: Array<{ id: string; numeroAsiento: string }> = [];
  try {
    totalPendientes = await prisma.asientoContable.count({ where });
    pendientes = await prisma.asientoContable.findMany({
      where,
      orderBy: [{ fechaContable: "asc" }, { numeroAsiento: "asc" }],
      take: 25,
      select: { id: true, numeroAsiento: true },
    });
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError("BATCH_START_FAILED", undefined, error);
  }

  let enviados = 0;
  let errores = 0;
  const resultados: LoteDespachoResultado["resultados"] = [];

  for (const pendiente of pendientes) {
    try {
      const despacho = await despacharAsiento(pendiente.id, usuario);
      enviados += 1;
      resultados.push({
        asientoId: pendiente.id,
        numeroAsiento: pendiente.numeroAsiento,
        estado: "ENVIADO",
        transaccionWsId: despacho.transaccionWsId,
      });
    } catch (error) {
      errores += 1;
      const integrationError =
        error instanceof IntegrationError
          ? error
          : new IntegrationError("WS_NETWORK_ERROR", "Error inesperado durante el despacho.");
      resultados.push({
        asientoId: pendiente.id,
        numeroAsiento: pendiente.numeroAsiento,
        estado: "ERROR",
        codigo: integrationError.code,
        mensaje: integrationError.message,
      });
    }
  }

  return {
    total: pendientes.length,
    enviados,
    errores,
    restantes: Math.max(0, totalPendientes - pendientes.length),
    resultados,
  };
}
