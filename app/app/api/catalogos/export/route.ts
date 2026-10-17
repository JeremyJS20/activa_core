import { NextRequest, NextResponse } from "next/server";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { ExportService, SupportedCatalog, SupportedFormat } from "@/lib/services/export.service";

const VALID_CATALOGS: SupportedCatalog[] = ["departamentos", "tipos-activos", "empleados"];
const VALID_FORMATS: SupportedFormat[] = ["xlsx", "csv"];

export async function GET(req: NextRequest) {
  try {
    const { authorized, response } = await checkSessionPermission("CAT_READ");
    if (!authorized) return response;

    const { searchParams } = new URL(req.url);
    const catalogo = searchParams.get("catalogo") as SupportedCatalog | null;
    const format = (searchParams.get("format") || "xlsx") as SupportedFormat;

    if (!catalogo || !VALID_CATALOGS.includes(catalogo)) {
      return NextResponse.json(
        {
          error: "INVALID_CATALOG_PARAM",
          message: `El parámetro 'catalogo' es requerido y debe ser uno de: ${VALID_CATALOGS.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json(
        {
          error: "INVALID_FORMAT_PARAM",
          message: `El parámetro 'format' debe ser 'xlsx' o 'csv'.`,
        },
        { status: 400 }
      );
    }

    const result = await ExportService.exportCatalog(catalogo, format);

    return new Response(typeof result.data === 'string' ? result.data : new Uint8Array(result.data), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[API_CATALOGOS_EXPORT_GET] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al procesar la exportación del catálogo.",
      },
      { status: 500 }
    );
  }
}
