import { NextRequest, NextResponse } from "next/server";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import {
  consultarDepreciacionExport,
  consultarInventarioExport,
} from "@/lib/services/report.service";
import {
  DEPRECIACION_REPORT_COLUMNS,
  INVENTARIO_REPORT_COLUMNS,
  buildReportCsv,
  buildReportXlsx,
  type ReportExportPayload,
} from "@/lib/services/export.service";
import {
  ExportQuerySchema,
  MAX_EXPORT_ROWS,
  parseEstadosParam,
} from "@/lib/schemas/report.schema";

/**
 * GET /api/reportes/export — Exportación tabular (XLSX/CSV) de los reportes.
 *
 * - `?precheck=true` devuelve el aviso de truncamiento ANTES de descargar.
 * - Toda exportación queda auditada en `bitacora_exportaciones`.
 * - Si la auditoría falla, la descarga NO se cancela (NFR-REP-005).
 */
export async function GET(req: NextRequest) {
  const { authorized, response, session } = await checkSessionPermission("REP_READ");
  if (!authorized) return response;

  const { searchParams } = new URL(req.url);

  const rawEstados = searchParams.getAll("estados");
  const queryParams = {
    reporte: searchParams.get("reporte") ?? undefined,
    formato: searchParams.get("formato") ?? undefined,
    precheck: searchParams.get("precheck") ?? undefined,
    fechaInicio: searchParams.get("fechaInicio") ?? undefined,
    fechaFin: searchParams.get("fechaFin") ?? undefined,
    montoMin: searchParams.get("montoMin") ?? undefined,
    montoMax: searchParams.get("montoMax") ?? undefined,
    departamentoId: searchParams.get("departamentoId") ?? undefined,
    tipoActivoId: searchParams.get("tipoActivoId") ?? undefined,
    custodio: searchParams.get("custodio") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    dir: searchParams.get("dir") ?? undefined,
    periodo: searchParams.get("periodo") ?? undefined,
    cuentaCompra: searchParams.get("cuentaCompra") ?? undefined,
    cuentaDepreciacion: searchParams.get("cuentaDepreciacion") ?? undefined,
    estados: rawEstados.length > 0 ? parseEstadosParam(rawEstados) : undefined,
  };

  const parsed = ExportQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "query");
      if (!errors[field]) errors[field] = issue.message;
    }

    return NextResponse.json(
      {
        type: "https://activacore.unapec.edu.do/problems/validation",
        title: "VALIDATION_ERROR",
        status: 400,
        detail: "Parámetros de exportación inválidos",
        errors,
      },
      { status: 400, headers: { "Content-Type": "application/problem+json" } }
    );
  }

  const query = parsed.data;

  if (query.reporte === "depreciacion" && !query.periodo) {
    return NextResponse.json(
      {
        type: "https://activacore.unapec.edu.do/problems/validation",
        title: "VALIDATION_ERROR",
        status: 400,
        detail: "Parámetros de exportación inválidos",
        errors: { periodo: "El período fiscal es obligatorio para el reporte de depreciación" },
      },
      { status: 400, headers: { "Content-Type": "application/problem+json" } }
    );
  }

  try {
    const emisor = session?.user?.correo ?? "usuario@unapec.edu.do";
    const hoy = new Date().toISOString().slice(0, 10);

    let payload: ReportExportPayload;
    let totalFiltrado: number;
    let truncated: boolean;
    let filenameBase: string;

    if (query.reporte === "inventario") {
      const snapshot = await consultarInventarioExport(
        {
          fechaInicio: query.fechaInicio,
          fechaFin: query.fechaFin,
          montoMin: query.montoMin,
          montoMax: query.montoMax,
          departamentoId: query.departamentoId,
          tipoActivoId: query.tipoActivoId,
          custodio: query.custodio,
          estados: query.estados,
          search: query.search,
          sort: query.sort,
          dir: query.dir,
          page: 1,
          pageSize: 25,
        },
        MAX_EXPORT_ROWS
      );

      totalFiltrado = snapshot.totalFiltrado;
      truncated = snapshot.truncated;

      const filtrosTexto = [
        query.fechaInicio ? `Desde ${query.fechaInicio}` : null,
        query.fechaFin ? `Hasta ${query.fechaFin}` : null,
        query.estados?.length ? `Estados: ${query.estados.join(", ")}` : null,
        query.search ? `Búsqueda: ${query.search}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      payload = {
        sheetName: "Inventario",
        title: "ActivaCore — Inventario de Activos Fijos",
        subtitle: `Emitido ${hoy} por ${emisor}${filtrosTexto ? ` · ${filtrosTexto}` : " · Sin filtros"}`,
        columns: INVENTARIO_REPORT_COLUMNS,
        rows: snapshot.rows.map((row) => ({
          codigo: row.codigo,
          descripcion: row.descripcion,
          tipoActivo: row.tipoActivo?.descripcion ?? "",
          departamento: row.departamento?.descripcion ?? "",
          custodio: row.custodio ? `${row.custodio.nombre} (${row.custodio.cedula})` : "",
          estado: row.estado,
          fechaAdquisicion: row.fechaAdquisicion,
          costoAdquisicion: row.costoAdquisicion,
          depreciacionAcumulada: row.depreciacionAcumulada,
          valorEnLibros: row.valorEnLibros,
        })),
        totals: {
          costoAdquisicion: snapshot.kpis.costoTotalAdquisicion,
          depreciacionAcumulada: snapshot.kpis.depreciacionAcumulada,
          valorEnLibros: snapshot.kpis.valorEnLibrosTotal,
        },
        truncated,
        maxRows: MAX_EXPORT_ROWS,
      };
      filenameBase = `inventario-activos-${hoy}`;
    } else {
      const snapshot = await consultarDepreciacionExport(
        {
          periodo: query.periodo!,
          cuentaCompra: query.cuentaCompra,
          cuentaDepreciacion: query.cuentaDepreciacion,
        },
        MAX_EXPORT_ROWS
      );

      totalFiltrado = snapshot.totalFiltrado;
      truncated = snapshot.truncated;

      payload = {
        sheetName: "Depreciación",
        title: `ActivaCore — Depreciación Fiscal del Período ${query.periodo}`,
        subtitle: `Emitido ${hoy} por ${emisor} · Período fiscal: ${query.periodo}`,
        columns: DEPRECIACION_REPORT_COLUMNS,
        rows: snapshot.rows.map((row) => ({
          codigo: row.codigo,
          descripcion: row.descripcion,
          vidaUtilMeses: row.vidaUtilMeses ?? "",
          costoOriginal: row.costoOriginal,
          cuotaMes: row.cuotaMes,
          depreciacionAcumulada: row.depreciacionAcumuladaHistorica,
          valorEnLibros: row.valorEnLibros,
          cuentaCompra: row.cuentaCompra,
          cuentaDepreciacion: row.cuentaDepreciacion,
        })),
        totals: {
          cuotaMes: snapshot.totales.cuotaTotalMes,
          depreciacionAcumulada: snapshot.totales.depreciacionAcumuladaTotal,
          valorEnLibros: snapshot.totales.valorEnLibrosTotal,
        },
        truncated,
        maxRows: MAX_EXPORT_ROWS,
      };
      filenameBase = `depreciacion-${query.periodo}-${hoy}`;
    }

    // Precheck: aviso de truncamiento ANTES de emitir el binario.
    if (query.precheck) {
      return NextResponse.json(
        {
          reporte: query.reporte,
          formato: query.formato,
          totalFiltrado,
          maxRows: MAX_EXPORT_ROWS,
          avisoTruncamiento: truncated,
        },
        { status: 200 }
      );
    }

    const extension = query.formato;
    const filename = `${filenameBase}.${extension}`;
    const data =
      query.formato === "xlsx" ? await buildReportXlsx(payload) : buildReportCsv(payload);

    const contentType =
      query.formato === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv; charset=utf-8";

    // Auditoría no bloqueante: un fallo aquí NUNCA cancela la descarga.
    try {
      const forwarded = req.headers.get("x-forwarded-for");
      const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";
      const userAgent = req.headers.get("user-agent") ?? null;

      await prisma.bitacoraExportacion.create({
        data: {
          usuarioId: session.user.id,
          correoUsuario: emisor,
          ipAddress: ip.slice(0, 45),
          userAgent: userAgent ? userAgent.slice(0, 400) : null,
          formato: query.formato.toUpperCase(),
          reporte: query.reporte.toUpperCase(),
          filtrosAplicados: {
            fechaInicio: query.fechaInicio ?? null,
            fechaFin: query.fechaFin ?? null,
            montoMin: query.montoMin ?? null,
            montoMax: query.montoMax ?? null,
            departamentoId: query.departamentoId ?? null,
            tipoActivoId: query.tipoActivoId ?? null,
            custodio: query.custodio ?? null,
            search: query.search ?? null,
            estados: query.estados ?? null,
            periodo: query.periodo ?? null,
            cuentaCompra: query.cuentaCompra ?? null,
            cuentaDepreciacion: query.cuentaDepreciacion ?? null,
          },
          filasExportadas: payload.rows.length,
        },
      });
    } catch (auditError) {
      console.error("[reportes/export] No se pudo registrar la auditoría:", auditError);
    }

    const body = typeof data === "string" ? data : new Uint8Array(data);

    return new NextResponse(body as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[reportes/export] Error al exportar:", error);
    return NextResponse.json(
      {
        type: "https://activacore.unapec.edu.do/problems/export-failed",
        title: "EXPORT_FAILED",
        status: 500,
        detail: "Exportación fallida — reintente.",
      },
      { status: 500, headers: { "Content-Type": "application/problem+json" } }
    );
  }
}
