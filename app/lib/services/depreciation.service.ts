import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularCuota } from "@/lib/depreciation/depreciation-calculator";
import { ESTADOS_DEPRECIABLES, evaluarDepreciabilidad } from "@/lib/depreciation/asset-universe";
import { DepreciationError, normalizarErrorMotor } from "@/lib/depreciation/errors";
import { crearAsiento, GrupoAsiento, resolverCuentaGasto } from "./asiento.service";
import { registrarAuditoria } from "./audit.service";

export interface EjecutarCorridaInput {
  periodoId: string;
  usuarioId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ResumenCorrida {
  periodoId: string;
  anio: number;
  mes: number;
  estado: string;
  totalActivos: number;
  totalCuota: string;
  activosOmitidos: number;
  activosExcluidos: number;
  asiento: {
    id: string;
    numeroAsiento: string;
    estado: string;
    totalDebito: string;
    totalCredito: string;
  };
}

const TAMANO_LOTE = 100;

/**
 * Ejecuta la corrida mensual de depreciación de forma transaccional:
 * bloquea el período, calcula el universo, reemplaza el detalle, actualiza
 * los acumulados del activo, genera el asiento y registra la auditoría.
 */
export async function ejecutarCorrida(input: EjecutarCorridaInput): Promise<ResumenCorrida> {
  return prisma.$transaction(
    async (tx) => {
      const bloqueo = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM periodos_depreciacion WHERE id = ${input.periodoId} FOR UPDATE
      `;

      if (bloqueo.length === 0) {
        throw new DepreciationError("PERIOD_NOT_FOUND", "El período solicitado no existe.");
      }

      const periodo = await tx.periodoDepreciacion.findUnique({
        where: { id: input.periodoId },
      });

      if (!periodo) {
        throw new DepreciationError("PERIOD_NOT_FOUND", "El período solicitado no existe.");
      }

      if (periodo.estado === "CERRADO") {
        throw new DepreciationError(
          "PERIOD_ALREADY_CLOSED",
          `El período ${String(periodo.mes).padStart(2, "0")}/${periodo.anio} está cerrado y no admite recálculo.`
        );
      }

      const activos = await tx.activoFijo.findMany({
        where: { estado: { in: [...ESTADOS_DEPRECIABLES] } },
        include: { tipoActivo: true, historialBaja: true },
        orderBy: { codigo: "asc" },
      });

      // Idempotencia de la re-ejecución: si el período ya tiene detalle, el estado base
      // de cada activo es el que existía ANTES de esa corrida, no la acumulada actual
      // (que ya incluye la cuota de este período). Sin esto, re-ejecutar duplicaría el cargo.
      const detallesPrevios = await tx.detalleDepreciacion.findMany({
        where: { periodoId: periodo.id },
        select: {
          activoId: true,
          depreciacionAcumuladaAnterior: true,
          valorEnLibrosAnterior: true,
        },
      });
      const basePorActivo = new Map(detallesPrevios.map((d) => [d.activoId, d]));

      const detalles: Prisma.DetalleDepreciacionCreateManyInput[] = [];
      const actualizaciones: Array<{ id: string; acumulada: Prisma.Decimal; valor: Prisma.Decimal }> = [];
      const reversiones: Array<{ id: string; acumulada: Prisma.Decimal; valor: Prisma.Decimal }> = [];
      const grupos = new Map<string, GrupoAsiento>();

      let totalCuota = new Prisma.Decimal(0);
      let activosOmitidos = 0;
      let activosExcluidos = 0;

      for (const activo of activos) {
        const base = basePorActivo.get(activo.id);
        const acumuladaBase = base
          ? base.depreciacionAcumuladaAnterior
          : activo.depreciacionAcumulada;
        const valorEnLibrosBase = base
          ? base.valorEnLibrosAnterior
          : activo.costoAdquisicion.minus(activo.depreciacionAcumulada);

        const evaluacion = evaluarDepreciabilidad({
          estadoActivo: activo.estado,
          fechaAdquisicion: activo.fechaAdquisicion,
          fechaBaja: activo.historialBaja?.fechaBaja ?? null,
          estadoTipoActivo: activo.tipoActivo.estado,
          costoAdquisicion: activo.costoAdquisicion,
          valorResidual: activo.valorResidual,
          depreciacionAcumulada: acumuladaBase,
          vidaUtilMeses: activo.tipoActivo.vidaUtilMeses,
          anio: periodo.anio,
          mes: periodo.mes,
        });

        if (!evaluacion.depreciable) {
          if (
            evaluacion.motivo === "VIDA_UTIL_AGOTADA" ||
            evaluacion.motivo === "SIN_REMANENTE"
          ) {
            activosOmitidos += 1;
          } else {
            activosExcluidos += 1;
          }
          // Si este activo se cargó en una corrida anterior del período, se revierte su cargo.
          if (base) {
            reversiones.push({
              id: activo.id,
              acumulada: base.depreciacionAcumuladaAnterior,
              valor: base.valorEnLibrosAnterior,
            });
          }
          continue;
        }

        let resultado;
        try {
          resultado = calcularCuota({
            costoAdquisicion: activo.costoAdquisicion,
            valorResidual: activo.valorResidual,
            depreciacionAcumulada: acumuladaBase,
            vidaUtilMeses: activo.tipoActivo.vidaUtilMeses,
          });
        } catch (error) {
          throw normalizarErrorMotor(error);
        }

        if (resultado.cuota.isZero()) {
          activosOmitidos += 1;
          if (base) {
            reversiones.push({
              id: activo.id,
              acumulada: base.depreciacionAcumuladaAnterior,
              valor: base.valorEnLibrosAnterior,
            });
          }
          continue;
        }

        const cuentaGasto = resolverCuentaGasto({
          cuentaContableGastoDepreciacion: activo.tipoActivo.cuentaContableGastoDepreciacion,
          cuentaContableDepreciacion: activo.tipoActivo.cuentaContableDepreciacion,
          metodoDepreciacion: activo.tipoActivo.metodoDepreciacion,
        });

        detalles.push({
          periodoId: periodo.id,
          activoId: activo.id,
          cuotaMensual: resultado.cuota,
          depreciacionAcumuladaAnterior: acumuladaBase,
          depreciacionAcumuladaNueva: resultado.acumuladaNueva,
          valorEnLibrosAnterior: valorEnLibrosBase,
          valorEnLibrosNuevo: resultado.valorEnLibrosNuevo,
          tipoCuota: resultado.tipoCuota,
          esCuotaFinal: resultado.esCuotaFinal,
        });

        actualizaciones.push({
          id: activo.id,
          acumulada: resultado.acumuladaNueva,
          valor: resultado.valorEnLibrosNuevo,
        });

        const clave = `${cuentaGasto}|${activo.tipoActivo.cuentaContableDepreciacion}`;
        const grupo = grupos.get(clave);
        if (grupo) {
          grupo.monto = grupo.monto.plus(resultado.cuota);
        } else {
          grupos.set(clave, {
            cuentaGasto,
            cuentaDepreciacion: activo.tipoActivo.cuentaContableDepreciacion,
            monto: resultado.cuota,
          });
        }

        totalCuota = totalCuota.plus(resultado.cuota);
      }

      if (detalles.length === 0) {
        throw new DepreciationError(
          "NO_DEPRECIABLE_ASSETS",
          "El período no contiene activos depreciables para procesar."
        );
      }

      await tx.detalleDepreciacion.deleteMany({ where: { periodoId: periodo.id } });
      await tx.detalleDepreciacion.createMany({ data: detalles });

      for (let i = 0; i < actualizaciones.length; i += TAMANO_LOTE) {
        const lote = actualizaciones.slice(i, i + TAMANO_LOTE);
        await Promise.all(
          lote.map((cambio) =>
            tx.activoFijo.update({
              where: { id: cambio.id },
              data: {
                depreciacionAcumulada: cambio.acumulada,
                valorEnLibros: cambio.valor,
              },
            })
          )
        );
      }

      // Activos que tenían detalle previo y ya no pertenecen al universo: se revierte su cargo.
      for (let i = 0; i < reversiones.length; i += TAMANO_LOTE) {
        const lote = reversiones.slice(i, i + TAMANO_LOTE);
        await Promise.all(
          lote.map((cambio) =>
            tx.activoFijo.update({
              where: { id: cambio.id },
              data: {
                depreciacionAcumulada: cambio.acumulada,
                valorEnLibros: cambio.valor,
              },
            })
          )
        );
      }

      const asiento = await crearAsiento(tx, {
        periodoId: periodo.id,
        anio: periodo.anio,
        mes: periodo.mes,
        grupos: Array.from(grupos.values()),
        total: totalCuota,
      });

      await tx.periodoDepreciacion.update({
        where: { id: periodo.id },
        data: {
          estado: "CALCULADO",
          totalActivos: detalles.length,
          totalCuota,
          activosOmitidos,
          activosExcluidos,
          fechaEjecucion: new Date(),
          ejecutadoPorId: input.usuarioId,
        },
      });

      await registrarAuditoria(tx, {
        usuarioId: input.usuarioId,
        accion: "DEPRECIATION_RUN",
        recurso: "periodos_depreciacion",
        recursoId: periodo.id,
        detalle: {
          anio: periodo.anio,
          mes: periodo.mes,
          totalActivos: detalles.length,
          totalCuota: totalCuota.toFixed(2),
          activosOmitidos,
          activosExcluidos,
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      return {
        periodoId: periodo.id,
        anio: periodo.anio,
        mes: periodo.mes,
        estado: "CALCULADO",
        totalActivos: detalles.length,
        totalCuota: totalCuota.toFixed(2),
        activosOmitidos,
        activosExcluidos,
        asiento: {
          id: asiento.id,
          numeroAsiento: asiento.numeroAsiento,
          estado: asiento.estado,
          totalDebito: asiento.totalDebito.toFixed(2),
          totalCredito: asiento.totalCredito.toFixed(2),
        },
      };
    },
    { timeout: 30000, maxWait: 15000 }
  );
}
