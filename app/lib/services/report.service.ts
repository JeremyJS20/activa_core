import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { InventarioQuery } from "@/lib/schemas/report.schema";

/**
 * Capa de consulta del Sub-módulo 04 (Reportes) — SOLO LECTURA.
 * Nunca muta el dominio de activos/depreciaciones (Sub-02/03).
 */

const DECIMAL_RADIX = 100;

export function halfUp(value: number): number {
  return Math.round((value + Number.EPSILON) * DECIMAL_RADIX) / DECIMAL_RADIX;
}

/** Convierte Decimal | number | string a string de 2 decimales (contrato API). */
export function moneyToString(value: Prisma.Decimal | number | string | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  const numeric = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(numeric)) return "0.00";
  return halfUp(numeric).toFixed(2);
}

/** Fecha → `YYYY-MM-DD` (fecha de calendario, sin desfase de zona). */
export function toIsoDateString(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** Fecha ISO corta → Date en UTC a medianoche. */
function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Construye el WHERE AND-componible del inventario (REQ-REP-001 y REQ-REP-003). */
export function buildInventarioWhere(query: InventarioQuery): Prisma.ActivoFijoWhereInput {
  const where: Prisma.ActivoFijoWhereInput = {};
  const and: Prisma.ActivoFijoWhereInput[] = [];

  if (query.fechaInicio || query.fechaFin) {
    const fechaFilter: Prisma.DateTimeFilter = {};
    if (query.fechaInicio) fechaFilter.gte = parseIsoDate(query.fechaInicio);
    if (query.fechaFin) fechaFilter.lte = parseIsoDate(query.fechaFin);
    and.push({ fechaAdquisicion: fechaFilter });
  }

  if (query.montoMin || query.montoMax) {
    const montoFilter: Prisma.DecimalFilter = {};
    if (query.montoMin) montoFilter.gte = new Prisma.Decimal(query.montoMin);
    if (query.montoMax) montoFilter.lte = new Prisma.Decimal(query.montoMax);
    and.push({ costoAdquisicion: montoFilter });
  }

  if (query.departamentoId) and.push({ departamentoId: query.departamentoId });
  if (query.tipoActivoId) and.push({ tipoActivoId: query.tipoActivoId });
  if (query.estados && query.estados.length > 0) and.push({ estado: { in: query.estados } });

  if (query.custodio) {
    const term = query.custodio;
    and.push({
      empleado: {
        OR: [
          { nombre: { contains: term, mode: "insensitive" } },
          { apellido: { contains: term, mode: "insensitive" } },
          { cedula: { contains: term, mode: "insensitive" } },
        ],
      },
    });
  }

  if (query.search) {
    and.push({
      OR: [
        { codigo: { contains: query.search, mode: "insensitive" } },
        { descripcion: { contains: query.search, mode: "insensitive" } },
        { numeroSerie: { contains: query.search, mode: "insensitive" } },
      ],
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** Whitelist de ordenamiento (nunca acepta un campo arbitrario del querystring). */
export function buildInventarioOrderBy(
  sort: InventarioQuery["sort"],
  dir: InventarioQuery["dir"]
): Prisma.ActivoFijoOrderByWithRelationInput {
  switch (sort) {
    case "descripcion":
      return { descripcion: dir };
    case "costo":
      return { costoAdquisicion: dir };
    case "fecha":
      return { fechaAdquisicion: dir };
    case "codigo":
    default:
      return { codigo: dir };
  }
}

export interface InventarioKpis {
  cantidadActivos: number;
  costoTotalAdquisicion: string;
  depreciacionAcumulada: string;
  valorEnLibrosTotal: string;
}

export interface InventarioMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: InventarioQuery["sort"];
  dir: InventarioQuery["dir"];
}

export interface InventarioRow {
  id: string;
  codigo: string;
  descripcion: string;
  numeroSerie: string | null;
  fechaAdquisicion: string;
  costoAdquisicion: string;
  depreciacionAcumulada: string;
  valorEnLibros: string;
  estado: string;
  tipoActivo: { id: string; descripcion: string; vidaUtilMeses: number } | null;
  departamento: { id: string; descripcion: string } | null;
  custodio: { id: string; nombre: string; cedula: string } | null;
}

export interface InventarioResult {
  meta: InventarioMeta;
  kpis: InventarioKpis;
  data: InventarioRow[];
}

/**
 * Consulta multicriterio del inventario con KPIs calculados sobre el TOTAL
 * del conjunto filtrado (no sobre la página) en una única transacción.
 */
export async function consultarInventario(query: InventarioQuery): Promise<InventarioResult> {
  const where = buildInventarioWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [rows, aggregate] = await prisma.$transaction([
    prisma.activoFijo.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: buildInventarioOrderBy(query.sort, query.dir),
      include: {
        tipoActivo: { select: { id: true, descripcion: true, vidaUtilMeses: true } },
        departamento: { select: { id: true, descripcion: true } },
        empleado: { select: { id: true, nombre: true, apellido: true, cedula: true } },
      },
    }),
    prisma.activoFijo.aggregate({
      where,
      _count: { _all: true },
      _sum: { costoAdquisicion: true, depreciacionAcumulada: true },
    }),
  ]);

  const cantidadActivos = aggregate._count?._all ?? 0;
  const costoTotal = Number(aggregate._sum?.costoAdquisicion ?? 0);
  const depreciacionTotal = Number(aggregate._sum?.depreciacionAcumulada ?? 0);

  const kpis: InventarioKpis = {
    cantidadActivos,
    costoTotalAdquisicion: moneyToString(costoTotal),
    depreciacionAcumulada: moneyToString(depreciacionTotal),
    valorEnLibrosTotal: moneyToString(costoTotal - depreciacionTotal),
  };

  const data: InventarioRow[] = rows.map((row) => ({
    id: row.id,
    codigo: row.codigo,
    descripcion: row.descripcion,
    numeroSerie: row.numeroSerie,
    fechaAdquisicion: toIsoDateString(row.fechaAdquisicion),
    costoAdquisicion: moneyToString(row.costoAdquisicion),
    depreciacionAcumulada: moneyToString(row.depreciacionAcumulada),
    valorEnLibros: moneyToString(row.valorEnLibros),
    estado: row.estado,
    tipoActivo: row.tipoActivo
      ? {
          id: row.tipoActivo.id,
          descripcion: row.tipoActivo.descripcion,
          vidaUtilMeses: row.tipoActivo.vidaUtilMeses,
        }
      : null,
    departamento: row.departamento
      ? { id: row.departamento.id, descripcion: row.departamento.descripcion }
      : null,
    custodio: row.empleado
      ? {
          id: row.empleado.id,
          nombre: `${row.empleado.nombre} ${row.empleado.apellido}`.trim(),
          cedula: row.empleado.cedula,
        }
      : null,
  }));

  const totalPages = cantidadActivos === 0 ? 0 : Math.ceil(cantidadActivos / query.pageSize);

  return {
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total: cantidadActivos,
      totalPages,
      sort: query.sort,
      dir: query.dir,
    },
    kpis,
    data,
  };
}

// ============================================================================
// REQ-REP-004 — Depreciación periódica y fiscal (solo lectura de Sub-03)
// ============================================================================

export interface DepreciacionRow {
  activoId: string;
  codigo: string;
  descripcion: string;
  vidaUtilMeses: number | null;
  costoOriginal: string;
  cuotaMes: string;
  depreciacionAcumuladaHistorica: string;
  valorEnLibros: string;
  cuentaCompra: string;
  cuentaDepreciacion: string;
}

export interface DepreciacionResult {
  meta: {
    periodo: string;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    sinProceso: boolean;
  };
  totales: {
    cuotaTotalMes: string;
    depreciacionAcumuladaTotal: string;
    valorEnLibrosTotal: string;
  };
  data: DepreciacionRow[];
}

export async function consultarDepreciacion(query: {
  periodo: string;
  cuentaCompra?: string;
  cuentaDepreciacion?: string;
  page: number;
  pageSize: number;
}): Promise<DepreciacionResult> {
  const where: Prisma.DepreciacionMensualWhereInput = { periodoFiscal: query.periodo };
  if (query.cuentaCompra) where.cuentaCompra = query.cuentaCompra;
  if (query.cuentaDepreciacion) where.cuentaDepreciacion = query.cuentaDepreciacion;

  const skip = (query.page - 1) * query.pageSize;

  const [rows, aggregate] = await prisma.$transaction([
    prisma.depreciacionMensual.findMany({
      where,
      skip,
      take: query.pageSize,
      orderBy: [{ activo: { codigo: "asc" } }, { activoId: "asc" }],
      include: {
        activo: {
          select: {
            codigo: true,
            descripcion: true,
            costoAdquisicion: true,
            tipoActivo: { select: { vidaUtilMeses: true } },
          },
        },
      },
    }),
    prisma.depreciacionMensual.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        cuotaMes: true,
        depreciacionAcumuladaPost: true,
        valorEnLibrosPost: true,
      },
    }),
  ]);

  const total = aggregate._count?._all ?? 0;

  const data: DepreciacionRow[] = rows.map((row) => ({
    activoId: row.activoId,
    codigo: row.activo.codigo,
    descripcion: row.activo.descripcion,
    vidaUtilMeses: row.activo.tipoActivo?.vidaUtilMeses ?? null,
    costoOriginal: moneyToString(row.activo.costoAdquisicion),
    cuotaMes: moneyToString(row.cuotaMes),
    depreciacionAcumuladaHistorica: moneyToString(row.depreciacionAcumuladaPost),
    valorEnLibros: moneyToString(row.valorEnLibrosPost),
    cuentaCompra: row.cuentaCompra,
    cuentaDepreciacion: row.cuentaDepreciacion,
  }));

  return {
    meta: {
      periodo: query.periodo,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      sinProceso: total === 0,
    },
    totales: {
      cuotaTotalMes: moneyToString(aggregate._sum?.cuotaMes),
      depreciacionAcumuladaTotal: moneyToString(aggregate._sum?.depreciacionAcumuladaPost),
      valorEnLibrosTotal: moneyToString(aggregate._sum?.valorEnLibrosPost),
    },
    data,
  };
}

// ============================================================================
// REQ-REP-005 — Kardex del activo (línea de tiempo inmutable, solo lectura)
// ============================================================================

export interface KardexTimelineEntry {
  tipo: string;
  fecha: string;
  custodioAnterior: string | null;
  custodioNuevo: string | null;
  departamentoAnterior: string | null;
  departamentoNuevo: string | null;
  justificacion: string;
  usuario: string;
}

export interface KardexCuotaRow {
  periodo: string;
  cuotaMes: string;
  depreciacionAcumulada: string;
  valorEnLibros: string;
}

export interface KardexResult {
  activo: {
    id: string;
    codigo: string;
    descripcion: string;
    estado: string;
    numeroSerie: string | null;
    fechaAdquisicion: string;
    costoAdquisicion: string;
    depreciacionAcumulada: string;
    valorEnLibros: string;
    tipoActivo: string | null;
    departamento: string | null;
    custodio: string | null;
    bajaInfo: {
      motivoBaja: string;
      justificacion: string;
      numeroActa: string;
      fechaBaja: string;
      valorEnLibrosAlBaja: string;
    } | null;
  };
  timeline: KardexTimelineEntry[];
  cuotas: KardexCuotaRow[];
}

function nombreCompleto(empleado: { nombre: string; apellido: string } | null | undefined): string | null {
  if (!empleado) return null;
  return `${empleado.nombre} ${empleado.apellido}`.trim();
}

/** Retorna null cuando el activo no existe (el handler responde 404). */
export async function consultarKardex(activoId: string): Promise<KardexResult | null> {
  const activo = await prisma.activoFijo.findUnique({
    where: { id: activoId },
    include: {
      tipoActivo: { select: { descripcion: true } },
      departamento: { select: { descripcion: true } },
      empleado: { select: { nombre: true, apellido: true } },
      historialBaja: true,
    },
  });

  if (!activo) return null;

  const [historial, cuotas] = await prisma.$transaction([
    prisma.historialCustodia.findMany({
      where: { activoId },
      orderBy: { createdAt: "desc" },
      include: {
        empleadoAnterior: { select: { nombre: true, apellido: true } },
        empleadoNuevo: { select: { nombre: true, apellido: true } },
        departamentoAnterior: { select: { descripcion: true } },
        departamentoNuevo: { select: { descripcion: true } },
        autorizadoPor: { select: { correo: true } },
      },
    }),
    prisma.depreciacionMensual.findMany({
      where: { activoId },
      orderBy: { periodoFiscal: "desc" },
    }),
  ]);

  return {
    activo: {
      id: activo.id,
      codigo: activo.codigo,
      descripcion: activo.descripcion,
      estado: activo.estado,
      numeroSerie: activo.numeroSerie,
      fechaAdquisicion: toIsoDateString(activo.fechaAdquisicion),
      costoAdquisicion: moneyToString(activo.costoAdquisicion),
      depreciacionAcumulada: moneyToString(activo.depreciacionAcumulada),
      valorEnLibros: moneyToString(activo.valorEnLibros),
      tipoActivo: activo.tipoActivo?.descripcion ?? null,
      departamento: activo.departamento?.descripcion ?? null,
      custodio: nombreCompleto(activo.empleado),
      bajaInfo: activo.historialBaja
        ? {
            motivoBaja: activo.historialBaja.motivoBaja,
            justificacion: activo.historialBaja.justificacion,
            numeroActa: activo.historialBaja.numeroActa,
            fechaBaja: toIsoDateString(activo.historialBaja.fechaBaja),
            valorEnLibrosAlBaja: moneyToString(activo.historialBaja.valorEnLibrosAlBaja),
          }
        : null,
    },
    timeline: historial.map((entry) => ({
      tipo: entry.motivo,
      fecha: entry.createdAt.toISOString(),
      custodioAnterior: nombreCompleto(entry.empleadoAnterior),
      custodioNuevo: nombreCompleto(entry.empleadoNuevo),
      departamentoAnterior: entry.departamentoAnterior?.descripcion ?? null,
      departamentoNuevo: entry.departamentoNuevo?.descripcion ?? null,
      justificacion: entry.justificacion,
      usuario: entry.autorizadoPor?.correo ?? "",
    })),
    cuotas: cuotas.map((cuota) => ({
      periodo: cuota.periodoFiscal,
      cuotaMes: moneyToString(cuota.cuotaMes),
      depreciacionAcumulada: moneyToString(cuota.depreciacionAcumuladaPost),
      valorEnLibros: moneyToString(cuota.valorEnLibrosPost),
    })),
  };
}
