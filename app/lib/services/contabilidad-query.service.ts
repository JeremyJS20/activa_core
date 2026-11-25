import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IntegrationError } from "@/lib/integracion/errors";
import {
  mapearTipoMovimiento,
  resolverCuentaGasto,
  type TipoActivoContableInfo,
} from "@/lib/integracion/payload";
import type { ListAsientosQuery } from "@/lib/schemas/integracion";

export interface KpisAsientos {
  total: number;
  pendientes: number;
  enviados: number;
  errores: number;
}

export interface AsientoListado {
  id: string;
  numeroAsiento: string;
  concepto: string;
  fechaContable: Date;
  estado: string;
  totalDebito: Prisma.Decimal;
  totalCredito: Prisma.Decimal;
  intentosEnvio: number;
  transaccionWsId: string | null;
  periodo: { anio: number; mes: number; estado: string };
}

export interface ListaAsientosResultado {
  items: AsientoListado[];
  total: number;
  kpis: KpisAsientos;
}

export interface LineaDetalle {
  id: string;
  tipoInventario: string | null;
  cuentaContable: string;
  tipoMovimiento: "DB" | "CR";
  monto: string;
  descripcion: string;
}

export interface AsientoDetalle {
  id: string;
  numeroAsiento: string;
  concepto: string;
  fechaContable: Date;
  estado: string;
  totalDebito: string;
  totalCredito: string;
  balance: string;
  intentosEnvio: number;
  transaccionWsId: string | null;
  codigoRespuestaWs: string | null;
  mensajeRespuestaWs: string | null;
  fechaEnvioWs: Date | null;
  periodo: { id: string; anio: number; mes: number; estado: string };
  lineas: LineaDetalle[];
  ultimoIntento: {
    intento: number;
    resultado: string;
    httpStatus: number | null;
    mensaje: string | null;
    createdAt: Date;
  } | null;
  puedeDespachar: boolean;
  puedeReintentar: boolean;
}

export interface BitacoraItem {
  id: string;
  asientoId: string;
  numeroAsiento: string;
  usuario: { id: string; correo: string };
  intento: number;
  payload: unknown;
  endpoint: string;
  httpStatus: number | null;
  respuesta: unknown;
  mensaje: string | null;
  duracionMs: number;
  resultado: string;
  correlationId: string;
  createdAt: Date;
}

export interface BitacoraResultado {
  items: BitacoraItem[];
  total: number;
}

function periodoFiltro(periodo?: string): Prisma.AsientoContableWhereInput {
  if (!periodo) return {};
  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) {
    throw new IntegrationError("VALIDATION_ERROR", "El período debe tener formato YYYY-MM.");
  }
  return { periodo: { anio, mes } };
}

function kpisDesdeGrupos(grupos: Array<{ estado: string; _count: { _all: number } }>): KpisAsientos {
  const kpis: KpisAsientos = { total: 0, pendientes: 0, enviados: 0, errores: 0 };
  for (const grupo of grupos) {
    const cantidad = grupo._count._all;
    kpis.total += cantidad;
    if (grupo.estado === "PENDIENTE_ENVIO") kpis.pendientes += cantidad;
    if (grupo.estado === "ENVIADO") kpis.enviados += cantidad;
    if (grupo.estado === "ERROR") kpis.errores += cantidad;
  }
  return kpis;
}

export async function listarAsientos(query: ListAsientosQuery): Promise<ListaAsientosResultado> {
  const where: Prisma.AsientoContableWhereInput = {
    ...(query.estado !== "TODOS" ? { estado: query.estado } : {}),
    ...periodoFiltro(query.periodo),
  };
  const kpisWhere: Prisma.AsientoContableWhereInput = {
    ...periodoFiltro(query.periodo),
  };

  const direccion: Prisma.SortOrder = query.dir;
  const orderBy: Prisma.AsientoContableOrderByWithRelationInput[] =
    query.sort === "numero"
      ? [{ numeroAsiento: direccion }]
      : [{ fechaContable: direccion }, { numeroAsiento: direccion }];

  const [total, items, grupos] = await Promise.all([
    prisma.asientoContable.count({ where }),
    prisma.asientoContable.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        numeroAsiento: true,
        concepto: true,
        fechaContable: true,
        estado: true,
        totalDebito: true,
        totalCredito: true,
        intentosEnvio: true,
        transaccionWsId: true,
        periodo: { select: { anio: true, mes: true, estado: true } },
      },
    }),
    prisma.asientoContable.groupBy({
      by: ["estado"],
      where: kpisWhere,
      _count: { _all: true },
    }),
  ]);

  return { items, total, kpis: kpisDesdeGrupos(grupos) };
}

function tiposPorCuenta(tipos: TipoActivoContableInfo[]) {
  const porDepreciacion = new Map<string, TipoActivoContableInfo[]>();
  const gastoPorCodigo = new Map<string, string>();

  for (const tipo of tipos) {
    const lista = porDepreciacion.get(tipo.cuentaContableDepreciacion) ?? [];
    lista.push(tipo);
    porDepreciacion.set(tipo.cuentaContableDepreciacion, lista);
    try {
      gastoPorCodigo.set(tipo.codigo, resolverCuentaGasto(tipo));
    } catch {
      // Tipo sin cuenta de gasto: no puede resolver líneas DB; se muestra "—".
    }
  }
  return { porDepreciacion, gastoPorCodigo };
}

function resolverTipoLineas(
  lineas: Array<{ id: string; cuentaContable: string; tipoMovimiento: string; monto: Prisma.Decimal }>,
  tipos: TipoActivoContableInfo[]
): Map<string, string | null> {
  const { porDepreciacion, gastoPorCodigo } = tiposPorCuenta(tipos);
  const resultado = new Map<string, string | null>();

  const creditos = lineas
    .filter((linea) => linea.tipoMovimiento === "CREDITO")
    .map((linea) => {
      const candidatos = porDepreciacion.get(linea.cuentaContable) ?? [];
      return {
        id: linea.id,
        monto: linea.monto.toFixed(2),
        tipo: candidatos.length === 1 ? candidatos[0] : null,
        usada: false,
      };
    });

  for (const linea of lineas) {
    if (linea.tipoMovimiento === "CREDITO") {
      const candidatos = porDepreciacion.get(linea.cuentaContable) ?? [];
      resultado.set(linea.id, candidatos.length === 1 ? candidatos[0].codigo : null);
      continue;
    }

    if (linea.tipoMovimiento === "DEBITO") {
      const monto = linea.monto.toFixed(2);
      const candidatos = creditos.filter(
        (cr) =>
          !cr.usada &&
          cr.tipo !== null &&
          cr.monto === monto &&
          gastoPorCodigo.get(cr.tipo.codigo) === linea.cuentaContable
      );
      if (candidatos.length === 1) {
        candidatos[0].usada = true;
        resultado.set(linea.id, candidatos[0].tipo?.codigo ?? null);
      } else {
        resultado.set(linea.id, null);
      }
    }
  }

  return resultado;
}

export async function obtenerAsiento(id: string): Promise<AsientoDetalle> {
  const asiento = await prisma.asientoContable.findUnique({
    where: { id },
    include: {
      lineas: true,
      periodo: { select: { id: true, anio: true, mes: true, estado: true } },
      envios: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!asiento) throw new IntegrationError("ASIENTO_NOT_FOUND");

  const tipos = await prisma.tipoActivo.findMany({
    where: { estado: "ACTIVO" },
    select: {
      codigo: true,
      cuentaContableGastoDepreciacion: true,
      cuentaContableDepreciacion: true,
      metodoDepreciacion: true,
    },
    orderBy: { codigo: "asc" },
  });

  const tiposPorLinea = resolverTipoLineas(asiento.lineas, tipos);

  const sumaDebito = asiento.lineas
    .filter((linea) => linea.tipoMovimiento === "DEBITO")
    .reduce((acc, linea) => acc.plus(linea.monto), new Prisma.Decimal(0));
  const sumaCredito = asiento.lineas
    .filter((linea) => linea.tipoMovimiento === "CREDITO")
    .reduce((acc, linea) => acc.plus(linea.monto), new Prisma.Decimal(0));
  const balance = sumaDebito.minus(sumaCredito).toFixed(2);
  const cuadrado = balance === "0.00";

  const ultimo = asiento.envios[0];

  return {
    id: asiento.id,
    numeroAsiento: asiento.numeroAsiento,
    concepto: asiento.concepto,
    fechaContable: asiento.fechaContable,
    estado: asiento.estado,
    totalDebito: asiento.totalDebito.toFixed(2),
    totalCredito: asiento.totalCredito.toFixed(2),
    balance,
    intentosEnvio: asiento.intentosEnvio,
    transaccionWsId: asiento.transaccionWsId,
    codigoRespuestaWs: asiento.codigoRespuestaWs,
    mensajeRespuestaWs: asiento.mensajeRespuestaWs,
    fechaEnvioWs: asiento.fechaEnvioWs,
    periodo: asiento.periodo,
    lineas: asiento.lineas.map((linea) => {
      let movimiento: "DB" | "CR" = "DB";
      try {
        movimiento = mapearTipoMovimiento(linea.tipoMovimiento);
      } catch {
        movimiento = linea.tipoMovimiento === "CREDITO" ? "CR" : "DB";
      }
      return {
        id: linea.id,
        tipoInventario: tiposPorLinea.get(linea.id) ?? null,
        cuentaContable: linea.cuentaContable,
        tipoMovimiento: movimiento,
        monto: linea.monto.toFixed(2),
        descripcion: linea.descripcion,
      };
    }),
    ultimoIntento: ultimo
      ? {
          intento: ultimo.intento,
          resultado: ultimo.resultado,
          httpStatus: ultimo.httpStatus,
          mensaje: ultimo.mensaje,
          createdAt: ultimo.createdAt,
        }
      : null,
    puedeDespachar: asiento.estado === "PENDIENTE_ENVIO" && cuadrado,
    puedeReintentar: asiento.estado === "ERROR" && cuadrado,
  };
}

export async function listarBitacora(
  asientoId: string,
  page: number,
  pageSize: number
): Promise<BitacoraResultado> {
  const [total, items] = await Promise.all([
    prisma.bitacoraEnvioWS.count({ where: { asientoId } }),
    prisma.bitacoraEnvioWS.findMany({
      where: { asientoId },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { usuario: { select: { id: true, correo: true } } },
    }),
  ]);

  return {
    items: items.map((item) => ({
      id: item.id,
      asientoId: item.asientoId,
      numeroAsiento: item.numeroAsiento,
      usuario: item.usuario,
      intento: item.intento,
      payload: item.payload,
      endpoint: item.endpoint,
      httpStatus: item.httpStatus,
      respuesta: item.respuesta,
      mensaje: item.mensaje,
      duracionMs: item.duracionMs,
      resultado: item.resultado,
      correlationId: item.correlationId,
      createdAt: item.createdAt,
    })),
    total,
  };
}
