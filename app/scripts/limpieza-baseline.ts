import { PrismaClient } from "@prisma/client";

/**
 * Limpieza "baseline demostrable" (opcion B aprobada 2026-11-03).
 *
 * CONSERVA: roles, permisos, roles_permisos, usuarios, departamentos,
 *           tipos_activos, empleados, 6 activos ACTIVO sin baja y el periodo
 *           del mes en curso en estado ABIERTO sin detalle.
 * ELIMINA:  el resto de activos, su historial, todos los periodos anteriores,
 *           el detalle de depreciacion, asientos, lineas, bajas, auditoria,
 *           bitacora de exportaciones y tokens de reseteo.
 *
 * Uso: npx tsx scripts/limpieza-baseline.ts            -> simulacion
 *      npx tsx scripts/limpieza-baseline.ts --apply    -> aplica
 */

const APLICAR = process.argv.includes("--apply");
const ACTIVOS_A_CONSERVAR = 6;

const prisma = new PrismaClient();

/** Mes en curso en la zona institucional (America/Santo_Domingo). */
function periodoActual(): { anio: number; mes: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const anio = Number(partes.find((p) => p.type === "year")?.value);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  return { anio, mes };
}

async function main(): Promise<void> {
  const { anio, mes } = periodoActual();

  const conservados = await prisma.activoFijo.findMany({
    where: { estado: "ACTIVO" },
    orderBy: { codigo: "asc" },
    select: { id: true, codigo: true, descripcion: true, costoAdquisicion: true },
    take: ACTIVOS_A_CONSERVAR,
  });
  const idsConservados = conservados.map((a) => a.id);

  const periodoVigente = await prisma.periodoDepreciacion.findFirst({
    where: { anio, mes },
    select: { id: true, estado: true },
  });

  const antes = {
    activos_fijos: await prisma.activoFijo.count(),
    historial_custodia: await prisma.historialCustodia.count(),
    historial_bajas: await prisma.historialBaja.count(),
    periodos_depreciacion: await prisma.periodoDepreciacion.count(),
    detalle_depreciacion: await prisma.detalleDepreciacion.count(),
    asientos_contables: await prisma.asientoContable.count(),
    lineas_asiento: await prisma.lineaAsiento.count(),
    auditoria: await prisma.auditoria.count(),
    bitacora_exportaciones: await prisma.bitacoraExportacion.count(),
    password_reset_tokens: await prisma.passwordResetToken.count(),
  };

  const plan = {
    modo: APLICAR ? "APLICAR" : "SIMULACION",
    periodoVigente: { anio, mes, existe: Boolean(periodoVigente), estado: periodoVigente?.estado ?? null },
    activosConservados: conservados,
    antes,
    seEliminaran: {
      activos_fijos: antes.activos_fijos - idsConservados.length,
      historialBajas: antes.historial_bajas,
      periodosAnteriores: antes.periodos_depreciacion - (periodoVigente ? 1 : 0),
      detalle_depreciacion: antes.detalle_depreciacion,
      asientos_contables: antes.asientos_contables,
      lineas_asiento: antes.lineas_asiento,
      auditoria: antes.auditoria,
      bitacora_exportaciones: antes.bitacora_exportaciones,
      password_reset_tokens: antes.password_reset_tokens,
      historialCustodiaDeActivosBorrados: await prisma.historialCustodia.count({
        where: { activoId: { notIn: idsConservados } },
      }),
    },
  };

  if (!APLICAR) {
    console.log(JSON.stringify(plan, null, 2));
    console.log("\n[SIMULACION] Nada fue modificado. Ejecuta con --apply para aplicar.");
    return;
  }

  if (idsConservados.length === 0) {
    throw new Error("No hay activos ACTIVO que conservar: se aborta para no dejar el inventario vacio.");
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // Hijos primero: lineas -> asientos -> detalle -> periodos.
    const lineas = await tx.lineaAsiento.deleteMany({});
    const asientos = await tx.asientoContable.deleteMany({});
    const detalle = await tx.detalleDepreciacion.deleteMany({});

    const periodosBorrados = await tx.periodoDepreciacion.deleteMany({
      where: { NOT: { anio, mes } },
    });

    // Periodo del mes en curso: vuelve a ABIERTO y sin corrida registrada.
    let periodoReiniciado = 0;
    if (periodoVigente) {
      await tx.periodoDepreciacion.update({
        where: { id: periodoVigente.id },
        data: {
          estado: "ABIERTO",
          totalActivos: 0,
          totalCuota: 0,
          activosOmitidos: 0,
          activosExcluidos: 0,
          fechaEjecucion: null,
          ejecutadoPorId: null,
          fechaCierre: null,
          cerradoPorId: null,
        },
      });
      periodoReiniciado = 1;
    } else {
      await tx.periodoDepreciacion.create({
        data: {
          anio,
          mes,
          estado: "ABIERTO",
          fechaCorte: new Date(Date.UTC(anio, mes, 0)),
        },
      });
      periodoReiniciado = 1;
    }

    const bajas = await tx.historialBaja.deleteMany({});
    const custodiaBorrada = await tx.historialCustodia.deleteMany({
      where: { activoId: { notIn: idsConservados } },
    });

    // Los activos conservados vuelven a su estado de compra (sin depreciacion aplicada).
    for (const activo of conservados) {
      await tx.activoFijo.update({
        where: { id: activo.id },
        data: { depreciacionAcumulada: 0, valorEnLibros: activo.costoAdquisicion },
      });
    }

    const activosBorrados = await tx.activoFijo.deleteMany({
      where: { id: { notIn: idsConservados } },
    });

    const auditoria = await tx.auditoria.deleteMany({});
    const bitacora = await tx.bitacoraExportacion.deleteMany({});
    const tokens = await tx.passwordResetToken.deleteMany({});

    return {
      lineas: lineas.count,
      asientos: asientos.count,
      detalle: detalle.count,
      periodosBorrados: periodosBorrados.count,
      periodoReiniciado,
      bajas: bajas.count,
      custodiaBorrada: custodiaBorrada.count,
      activosBorrados: activosBorrados.count,
      auditoria: auditoria.count,
      bitacora: bitacora.count,
      tokens: tokens.count,
    };
  });

  const despues = {
    activos_fijos: await prisma.activoFijo.count(),
    historial_custodia: await prisma.historialCustodia.count(),
    historial_bajas: await prisma.historialBaja.count(),
    periodos_depreciacion: await prisma.periodoDepreciacion.count(),
    detalle_depreciacion: await prisma.detalleDepreciacion.count(),
    asientos_contables: await prisma.asientoContable.count(),
    lineas_asiento: await prisma.lineaAsiento.count(),
    auditoria: await prisma.auditoria.count(),
    bitacora_exportaciones: await prisma.bitacoraExportacion.count(),
    password_reset_tokens: await prisma.passwordResetToken.count(),
    roles: await prisma.rol.count(),
    permisos: await prisma.permiso.count(),
    roles_permisos: await prisma.rolPermiso.count(),
    usuarios: await prisma.usuario.count(),
    departamentos: await prisma.departamento.count(),
    tipos_activos: await prisma.tipoActivo.count(),
    empleados: await prisma.empleado.count(),
  };

  console.log(JSON.stringify({ aplicado: true, borrado: resultado, despues }, null, 2));
}

main().finally(() => prisma.$disconnect());
