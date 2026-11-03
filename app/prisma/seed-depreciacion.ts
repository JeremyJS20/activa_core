import { Prisma, PrismaClient } from "@prisma/client";
import { calcularCuota, mesesTranscurridos } from "../lib/depreciation/depreciation-calculator";

const MESES_HISTORICOS = 12;

function ultimoDiaDelMes(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes, 0));
}

interface DetalleSeed {
  periodoId: string;
  activoId: string;
  cuotaMensual: Prisma.Decimal;
  depreciacionAcumuladaAnterior: Prisma.Decimal;
  depreciacionAcumuladaNueva: Prisma.Decimal;
  valorEnLibrosAnterior: Prisma.Decimal;
  valorEnLibrosNuevo: Prisma.Decimal;
  tipoCuota: string;
  esCuotaFinal: boolean;
}

/**
 * Genera períodos de depreciación de demostración:
 * - Los últimos 12 meses quedan en estado CERRADO con su detalle calculado.
 * - El mes en curso queda en estado ABIERTO y sin detalle, listo para ejecutarse.
 *
 * Es idempotente: re-ejecutar el seed reemplaza el detalle de cada período.
 */
export async function seedPeriodosDepreciacion(
  prisma: PrismaClient,
  adminUserId: string
): Promise<void> {
  console.log("\n=== [5/5] Sembrando Períodos de Depreciación Demonstrativos ===");

  const activos = await prisma.activoFijo.findMany({
    where: { estado: { in: ["ACTIVO", "EN_MANTENIMIENTO"] } },
    include: { tipoActivo: true },
    orderBy: { codigo: "asc" },
  });

  if (activos.length === 0) {
    console.log("  - Sin activos depreciables: no se generan períodos de demostración.");
    return;
  }

  const ahora = new Date();
  const anioActual = ahora.getUTCFullYear();
  const mesActual = ahora.getUTCMonth() + 1;

  const periodos: Array<{ anio: number; mes: number }> = [];
  for (let i = MESES_HISTORICOS; i >= 0; i--) {
    const referencia = new Date(Date.UTC(anioActual, mesActual - 1 - i, 1));
    periodos.push({
      anio: referencia.getUTCFullYear(),
      mes: referencia.getUTCMonth() + 1,
    });
  }

  let totalDetalles = 0;

  for (const { anio, mes } of periodos) {
    const corte = ultimoDiaDelMes(anio, mes);
    const esMesActual = anio === anioActual && mes === mesActual;
    const estado = esMesActual ? "ABIERTO" : "CERRADO";

    const periodo = await prisma.periodoDepreciacion.upsert({
      where: { anio_mes: { anio, mes } },
      update: { fechaCorte: corte, estado },
      create: { anio, mes, fechaCorte: corte, estado },
    });

    await prisma.detalleDepreciacion.deleteMany({ where: { periodoId: periodo.id } });

    if (esMesActual) {
      await prisma.periodoDepreciacion.update({
        where: { id: periodo.id },
        data: {
          estado: "ABIERTO",
          totalActivos: 0,
          totalCuota: new Prisma.Decimal(0),
          activosOmitidos: 0,
          activosExcluidos: 0,
          fechaEjecucion: null,
          ejecutadoPorId: null,
          fechaCierre: null,
          cerradoPorId: null,
        },
      });
      console.log(`  - ${anio}-${String(mes).padStart(2, "0")}: ABIERTO (listo para ejecutar)`);
      continue;
    }

    const detalles: DetalleSeed[] = [];
    let totalCuota = new Prisma.Decimal(0);
    let activosOmitidos = 0;
    let activosExcluidos = 0;

    for (const activo of activos) {
      const vidaUtil = activo.tipoActivo.vidaUtilMeses;
      const indice = mesesTranscurridos(activo.fechaAdquisicion, anio, mes);

      if (indice < 1) {
        activosExcluidos += 1;
        continue;
      }
      if (indice > vidaUtil) {
        activosOmitidos += 1;
        continue;
      }

      const depreciable = activo.costoAdquisicion.minus(activo.valorResidual);
      const cuotaTeorica = depreciable
        .dividedBy(vidaUtil)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);

      let acumuladaAnterior = cuotaTeorica.times(indice - 1);
      if (acumuladaAnterior.greaterThan(depreciable)) {
        acumuladaAnterior = depreciable;
      }
      const valorEnLibrosAnterior = activo.costoAdquisicion.minus(acumuladaAnterior);

      const resultado = calcularCuota({
        costoAdquisicion: activo.costoAdquisicion,
        valorResidual: activo.valorResidual,
        depreciacionAcumulada: acumuladaAnterior,
        vidaUtilMeses: vidaUtil,
      });

      if (resultado.cuota.isZero()) {
        activosOmitidos += 1;
        continue;
      }

      detalles.push({
        periodoId: periodo.id,
        activoId: activo.id,
        cuotaMensual: resultado.cuota,
        depreciacionAcumuladaAnterior: acumuladaAnterior,
        depreciacionAcumuladaNueva: resultado.acumuladaNueva,
        valorEnLibrosAnterior,
        valorEnLibrosNuevo: resultado.valorEnLibrosNuevo,
        tipoCuota: resultado.tipoCuota,
        esCuotaFinal: resultado.esCuotaFinal,
      });

      totalCuota = totalCuota.plus(resultado.cuota);
    }

    if (detalles.length > 0) {
      await prisma.detalleDepreciacion.createMany({ data: detalles });
      totalDetalles += detalles.length;
    }

    await prisma.periodoDepreciacion.update({
      where: { id: periodo.id },
      data: {
        estado: "CERRADO",
        totalActivos: detalles.length,
        totalCuota,
        activosOmitidos,
        activosExcluidos,
        fechaEjecucion: new Date(),
        ejecutadoPorId: adminUserId,
        fechaCierre: new Date(),
        cerradoPorId: adminUserId,
      },
    });

    console.log(
      `  - ${anio}-${String(mes).padStart(2, "0")}: CERRADO (${detalles.length} activos, RD$ ${totalCuota.toFixed(2)})`
    );
  }

  console.log(`Períodos de depreciación generados: ${periodos.length} · Detalles: ${totalDetalles}`);
}
