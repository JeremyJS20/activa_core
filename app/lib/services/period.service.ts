import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DepreciationError } from "@/lib/depreciation/errors";
import { esPeriodoValido, fechaCorte } from "@/lib/depreciation/period-utils";
import { registrarAuditoria } from "./audit.service";

export interface ListarPeriodosInput {
  page: number;
  pageSize: number;
  estado: "ABIERTO" | "CALCULADO" | "CERRADO" | "TODOS";
  anio?: number;
}

export interface MetaSolicitud {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function crearPeriodo(input: { anio: number; mes: number }) {
  if (!esPeriodoValido(input.anio, input.mes)) {
    throw new DepreciationError(
      "INVALID_PERIOD_FORMAT",
      "El período debe tener un año entre 2000 y 2100 y un mes entre 1 y 12."
    );
  }

  const existente = await prisma.periodoDepreciacion.findUnique({
    where: { anio_mes: { anio: input.anio, mes: input.mes } },
  });

  if (existente) {
    throw new DepreciationError(
      "PERIOD_ALREADY_EXISTS",
      `Ya existe un período registrado para ${String(input.mes).padStart(2, "0")}/${input.anio}.`
    );
  }

  return prisma.periodoDepreciacion.create({
    data: {
      anio: input.anio,
      mes: input.mes,
      estado: "ABIERTO",
      fechaCorte: fechaCorte(input.anio, input.mes),
    },
  });
}

export async function listarPeriodos(input: ListarPeriodosInput) {
  const where: Prisma.PeriodoDepreciacionWhereInput = {};

  if (input.estado !== "TODOS") {
    where.estado = input.estado;
  }
  if (input.anio) {
    where.anio = input.anio;
  }

  const [total, items] = await Promise.all([
    prisma.periodoDepreciacion.count({ where }),
    prisma.periodoDepreciacion.findMany({
      where,
      orderBy: [{ anio: "desc" }, { mes: "desc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        ejecutadoPor: { select: { id: true, nombre: true } },
        cerradoPor: { select: { id: true, nombre: true } },
      },
    }),
  ]);

  return { items, total };
}

export async function obtenerPeriodo(id: string) {
  const periodo = await prisma.periodoDepreciacion.findUnique({
    where: { id },
    include: {
      ejecutadoPor: { select: { id: true, nombre: true } },
      cerradoPor: { select: { id: true, nombre: true } },
      detalles: {
        include: {
          activo: { select: { id: true, codigo: true, descripcion: true } },
        },
        orderBy: { cuotaMensual: "desc" },
      },
      asiento: { include: { lineas: true } },
    },
  });

  if (!periodo) {
    throw new DepreciationError("PERIOD_NOT_FOUND", "El período solicitado no existe.");
  }

  return periodo;
}

export async function cerrarPeriodo(
  id: string,
  usuarioId: string,
  meta: MetaSolicitud = {}
) {
  return prisma.$transaction(
    async (tx) => {
      const periodo = await tx.periodoDepreciacion.findUnique({
        where: { id },
        include: { _count: { select: { detalles: true } } },
      });

      if (!periodo) {
        throw new DepreciationError("PERIOD_NOT_FOUND", "El período solicitado no existe.");
      }

      if (periodo.estado === "CERRADO") {
        throw new DepreciationError(
          "PERIOD_IMMUTABLE",
          `El período ${String(periodo.mes).padStart(2, "0")}/${periodo.anio} ya fue cerrado y no admite reapertura. Registre un asiento de ajuste en el período abierto.`
        );
      }

      if (periodo.estado !== "CALCULADO") {
        throw new DepreciationError(
          "PERIOD_NOT_CLOSABLE",
          "Solo puede cerrarse un período con la corrida de depreciación ejecutada."
        );
      }

      if (periodo._count.detalles === 0) {
        throw new DepreciationError(
          "PERIOD_HAS_NO_DETAIL",
          "El período no posee detalle de depreciación calculado."
        );
      }

      const actualizado = await tx.periodoDepreciacion.update({
        where: { id },
        data: {
          estado: "CERRADO",
          fechaCierre: new Date(),
          cerradoPorId: usuarioId,
        },
      });

      await registrarAuditoria(tx, {
        usuarioId,
        accion: "PERIOD_CLOSE",
        recurso: "periodos_depreciacion",
        recursoId: id,
        detalle: {
          anio: periodo.anio,
          mes: periodo.mes,
          totalActivos: periodo.totalActivos,
          totalCuota: periodo.totalCuota.toFixed(2),
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return actualizado;
    },
    { timeout: 20000, maxWait: 10000 }
  );
}
