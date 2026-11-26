import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Seed de demostración del Sub-módulo 05 (solo dev/E2E).
 *
 * Garantiza:
 *  - Usuario AUDITOR para probar el acceso de solo lectura.
 *  - 3 asientos representativos en períodos cerrados recientes:
 *      PENDIENTE_ENVIO, ERROR (con 1 intento en bitácora) y ENVIADO.
 *
 * Es idempotente: upsert de asientos por `numeroAsiento`, upsert del auditor y
 * creación de la bitácora solo si no existe (la tabla es append-only).
 *
 * NO ejecutar en producción.
 */

const prisma = new PrismaClient();

const CUENTAS_GASTO_POR_METODO: Record<string, string> = {
  DGII_CAT1: "6-30-01-0001",
  DGII_CAT2: "6-30-01-0002",
  DGII_CAT3: "6-30-01-0003",
  LINEA_RECTA: "6-30-01-0002",
};

function ultimoDiaDelMes(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes, 0));
}

function periodoAnterior(anio: number, mes: number, offset: number): { anio: number; mes: number } {
  let m = mes - offset;
  let a = anio;
  while (m <= 0) {
    m += 12;
    a -= 1;
  }
  return { anio: a, mes: m };
}

function ym(anio: number, mes: number): string {
  return `${anio}${String(mes).padStart(2, "0")}`;
}

async function main() {
  console.log("=== [Sub-05] Seed de integración contable (dev/E2E) ===");

  const admin = await prisma.usuario.findUnique({
    where: { correo: "admin@unapec.edu.do" },
    include: { rol: true },
  });
  if (!admin) {
    throw new Error("No existe admin@unapec.edu.do. Ejecuta primero `pnpm prisma db seed`.");
  }

  const rolAuditor = await prisma.rol.findUnique({ where: { codigo: "AUDITOR" } });
  if (!rolAuditor) {
    throw new Error("No existe el rol AUDITOR. Ejecuta primero `pnpm prisma db seed`.");
  }

  const auditor = await prisma.usuario.upsert({
    where: { correo: "auditor@unapec.edu.do" },
    update: {
      nombre: "Auditor de Cumplimiento (Demo)",
      passwordHash: await bcrypt.hash("Auditor2026!", 10),
      rolId: rolAuditor.id,
      estado: "ACTIVO",
    },
    create: {
      nombre: "Auditor de Cumplimiento (Demo)",
      correo: "auditor@unapec.edu.do",
      passwordHash: await bcrypt.hash("Auditor2026!", 10),
      rolId: rolAuditor.id,
      estado: "ACTIVO",
    },
  });
  console.log(`  - Auditor verificado: ${auditor.correo}`);

  const tipo = await prisma.tipoActivo.findFirst({
    where: { estado: "ACTIVO" },
    orderBy: { codigo: "asc" },
  });
  if (!tipo) {
    throw new Error("No existe ningún TipoActivo. Ejecuta primero `pnpm prisma db seed`.");
  }

  const cuentaGasto =
    tipo.cuentaContableGastoDepreciacion ??
    CUENTAS_GASTO_POR_METODO[tipo.metodoDepreciacion] ??
    "6-30-01-0002";
  const cuentaDepreciacion = tipo.cuentaContableDepreciacion;

  const hoy = new Date();
  const anioActual = hoy.getUTCFullYear();
  const mesActual = hoy.getUTCMonth() + 1;

  // Los tres meses cerrados inmediatamente anteriores al mes en curso.
  const objetivos = [1, 2, 3].map((offset) => periodoAnterior(anioActual, mesActual, offset));

  const estados = ["PENDIENTE_ENVIO", "ERROR", "ENVIADO"] as const;
  let asientosCreados = 0;
  let logCreado = 0;

  for (let index = 0; index < objetivos.length; index += 1) {
    const { anio, mes } = objetivos[index];
    const corte = ultimoDiaDelMes(anio, mes);
    const fechaContable = corte;
    const numeroPeriodo = ym(anio, mes);

    const periodo = await prisma.periodoDepreciacion.upsert({
      where: { anio_mes: { anio, mes } },
      update: { estado: "CERRADO", fechaCorte: corte },
      create: { anio, mes, estado: "CERRADO", fechaCorte: corte },
    });

    const existente = await prisma.asientoContable.findUnique({
      where: { periodoId: periodo.id },
    });
    const numeroAsiento = existente?.numeroAsiento ?? `DEP-${numeroPeriodo}-001`;
    const estado = estados[index];
    const monto = new Prisma.Decimal("1000.00");

    const comun = {
      concepto: `Depreciación ${String(mes).padStart(2, "0")}/${anio}`,
      fechaContable,
      totalDebito: monto,
      totalCredito: monto,
    };

    const lineas = [
      {
        cuentaContable: cuentaGasto,
        tipoMovimiento: "DEBITO",
        monto,
        descripcion: `Gasto por depreciación ${String(mes).padStart(2, "0")}/${anio}`,
      },
      {
        cuentaContable: cuentaDepreciacion,
        tipoMovimiento: "CREDITO",
        monto,
        descripcion: `Depreciación acumulada ${String(mes).padStart(2, "0")}/${anio}`,
      },
    ];

    const datosEstado =
      estado === "PENDIENTE_ENVIO"
        ? {
            estado,
            intentosEnvio: 0,
            transaccionWsId: null,
            codigoRespuestaWs: null,
            mensajeRespuestaWs: null,
            fechaEnvioWs: null,
          }
        : estado === "ERROR"
          ? {
              estado,
              intentosEnvio: 1,
              transaccionWsId: null,
              codigoRespuestaWs: "500",
              mensajeRespuestaWs: "Falla simulada del servidor contable (seed E2E)",
              fechaEnvioWs: new Date(),
            }
          : {
              estado,
              intentosEnvio: 1,
              transaccionWsId: `WS-${numeroPeriodo}28-90001`,
              codigoRespuestaWs: "201",
              mensajeRespuestaWs: "Asiento registrado en Contabilidad General (seed E2E)",
              fechaEnvioWs: new Date(),
            };

    const asiento = await prisma.asientoContable.upsert({
      where: { numeroAsiento },
      update: { ...comun, ...datosEstado, lineas: { deleteMany: {}, create: lineas } },
      create: { numeroAsiento, periodoId: periodo.id, ...comun, ...datosEstado, lineas: { create: lineas } },
    });
    asientosCreados += 1;

    if (estado === "ERROR") {
      const logExistente = await prisma.bitacoraEnvioWS.findUnique({
        where: { asientoId_intento: { asientoId: asiento.id, intento: 1 } },
      });
      if (!logExistente) {
        await prisma.bitacoraEnvioWS.create({
          data: {
            asientoId: asiento.id,
            numeroAsiento: asiento.numeroAsiento,
            usuarioId: admin.id,
            correoUsuario: admin.correo,
            intento: 1,
            payload: {
              numeroAsiento: asiento.numeroAsiento,
              concepto: asiento.concepto,
              fechaAsiento: asiento.fechaContable.toISOString().slice(0, 10),
              estado: "PENDIENTE_ENVIO",
              lineas: [
                {
                  tipoInventario: tipo.codigo,
                  cuentaContable: cuentaGasto,
                  tipoMovimiento: "DB",
                  monto: "1000.00",
                  descripcion: `Gasto por depreciación ${String(mes).padStart(2, "0")}/${anio}`,
                },
                {
                  tipoInventario: tipo.codigo,
                  cuentaContable: cuentaDepreciacion,
                  tipoMovimiento: "CR",
                  monto: "1000.00",
                  descripcion: `Depreciación acumulada ${String(mes).padStart(2, "0")}/${anio}`,
                },
              ],
              totalDebito: "1000.00",
              totalCredito: "1000.00",
            },
            endpoint: "http://localhost:3000/api/mock/contabilidad/asientos",
            httpStatus: 500,
            respuesta: {
              codigo: "WS_SERVER_ERROR",
              mensaje: "Falla simulada del servidor contable (seed E2E)",
            },
            mensaje: "Falla simulada del servidor contable (seed E2E)",
            duracionMs: 120,
            resultado: "RECHAZADO",
            correlationId: "seed-integracion-error-001",
          },
        });
        logCreado += 1;
      }
    }

    console.log(`  - ${numeroPeriodo}: ${estado} (${asiento.numeroAsiento})`);
  }

  console.log(
    `[Sub-05] Seed completado: ${asientosCreados} asientos, ${logCreado} evento(s) de bitácora nuevos, auditor ${auditor.correo}.`
  );
}

main()
  .catch((e) => {
    console.error("Error fatal durante el seed de integración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
