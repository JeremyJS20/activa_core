"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  X,
} from "lucide-react";

type ReporteKey = "inventario" | "depreciacion";
type FormatoExport = "xlsx" | "csv";

interface ExportButtonsProps {
  reporteKey: ReporteKey;
  /** Querystring del reporte origen (filtros + orden), sin `reporte` ni `formato`. */
  exportQuery: string;
  /** Bloquea exportación e impresión mientras no haya datos cargados. */
  disabled: boolean;
}

interface TruncationState {
  formato: FormatoExport;
  totalFiltrado: number;
  maxRows: number;
}

interface PrecheckResponse {
  totalFiltrado: number;
  maxRows: number;
  avisoTruncamiento: boolean;
}

function buildExportUrl(
  reporteKey: ReporteKey,
  exportQuery: string,
  formato: FormatoExport,
  precheck = false
): string {
  const params = new URLSearchParams(exportQuery);
  params.set("reporte", reporteKey);
  params.set("formato", formato);
  if (precheck) params.set("precheck", "true");
  return `/api/reportes/export?${params.toString()}`;
}

async function readProblemDetail(res: Response): Promise<string> {
  const problem = await res.json().catch(() => null);
  const detail = problem?.errors
    ? Object.values(problem.errors as Record<string, string>)[0]
    : problem?.detail;
  return detail || "No fue posible generar la exportación.";
}

/** Marca de emisión para el membrete de impresión. */
function formatStamp(): string {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

/**
 * Membrete institucional visible únicamente en `@media print`
 * (REQ-REP-008): usuario emisor, fecha/hora y filtros activos.
 */
export function PrintHeader({ title, filters }: { title: string; filters: string[] }) {
  const { data: session } = useSession();
  const [stamp, setStamp] = useState("");

  useEffect(() => {
    const update = () => setStamp(formatStamp());
    // setState asíncrono (timer) para respetar las reglas del React Compiler.
    const initial = setTimeout(update, 0);
    window.addEventListener("beforeprint", update);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("beforeprint", update);
    };
  }, []);

  const emisor =
    session?.user?.nombre || session?.user?.correo || session?.user?.email || "Usuario institucional";

  return (
    <div className="hidden print:block mb-4">
      <div className="border-b-2 border-[#002D62] pb-3 flex items-start justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#002D62] font-mono">
            Universidad APEC · UNAPEC
          </p>
          <h1 className="text-xl font-extrabold tracking-tight text-[#1B2A4A] mt-0.5">
            {title}
          </h1>
          <p className="text-[11px] text-slate-600 mt-1">
            <span className="font-semibold text-slate-700">Filtros activos:</span>{" "}
            {filters.length > 0 ? filters.join(" · ") : "Sin filtros"}
          </p>
        </div>
        <div className="text-right text-[10px] text-slate-600 font-mono leading-relaxed shrink-0">
          <p className="font-semibold text-[#1B2A4A]">ActivaCore · Reportes DGII</p>
          <p>Emitido: {stamp || "—"}</p>
          <p>Por: {emisor}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * REQ-REP-006 / REQ-REP-007 / REQ-REP-008 — Exportación tabular con precheck
 * de truncamiento (10,000 filas) e impresión con membrete institucional.
 */
export function ExportButtons({ reporteKey, exportQuery, disabled }: ExportButtonsProps) {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [truncation, setTruncation] = useState<TruncationState | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Cierre del aviso de truncamiento con ESC.
  useEffect(() => {
    if (!truncation) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTruncation(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [truncation]);

  const download = useCallback(
    async (formato: FormatoExport) => {
      const res = await fetch(buildExportUrl(reporteKey, exportQuery, formato));
      if (!res.ok) throw new Error(await readProblemDetail(res));

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      let filename = `reporte_${reporteKey}.${formato}`;

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);

      showToast("success", `Reporte exportado exitosamente a formato ${formato.toUpperCase()}`);
    },
    [exportQuery, reporteKey, showToast]
  );

  const handleExport = useCallback(
    async (formato: FormatoExport) => {
      setIsExportOpen(false);
      setIsBusy(true);
      try {
        // Paso 1 — precheck: aviso ANTES de emitir el binario.
        const checkRes = await fetch(buildExportUrl(reporteKey, exportQuery, formato, true));
        if (!checkRes.ok) throw new Error(await readProblemDetail(checkRes));

        const check = (await checkRes.json()) as PrecheckResponse;
        if (check.avisoTruncamiento) {
          setTruncation({
            formato,
            totalFiltrado: check.totalFiltrado,
            maxRows: check.maxRows,
          });
          return;
        }

        // Paso 2 — descarga efectiva (auditada).
        await download(formato);
      } catch (err) {
        showToast(
          "error",
          err instanceof Error ? err.message : "Exportación fallida — reintente"
        );
      } finally {
        setIsBusy(false);
      }
    },
    [download, exportQuery, reporteKey, showToast]
  );

  const confirmTruncatedDownload = useCallback(async () => {
    if (!truncation) return;
    const { formato } = truncation;
    setTruncation(null);
    setIsBusy(true);
    try {
      await download(formato);
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Exportación fallida — reintente"
      );
    } finally {
      setIsBusy(false);
    }
  }, [download, showToast, truncation]);

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 no-print flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border animate-in slide-in-from-bottom-3 duration-200 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="flex items-center gap-2.5 no-print">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={disabled}
          title="Imprimir reporte (membrete institucional)"
          aria-label="Imprimir reporte"
          className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsExportOpen(!isExportOpen)}
            disabled={isBusy || disabled}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#003D9B]" />
            ) : (
              <Download className="w-4 h-4 text-slate-500" />
            )}
            <span>Exportar</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isExportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsExportOpen(false)} />
              <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50 text-sm animate-in fade-in-50 zoom-in-95">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Formato de Archivo
                </div>
                <button
                  type="button"
                  onClick={() => handleExport("xlsx")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-medium block leading-none">Libro Excel (.xlsx)</span>
                    <span className="text-[11px] text-slate-400">Formato RD$ UNAPEC</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <FileText className="w-4 h-4 text-sky-600" />
                  <div>
                    <span className="font-medium block leading-none">Archivo CSV (.csv)</span>
                    <span className="text-[11px] text-slate-400">UTF-8 BOM (Windows)</span>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Aviso de truncamiento (precheck) */}
      {truncation && (
        <div
          className="fixed inset-0 z-[60] no-print bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(event) => {
            if (event.target === event.currentTarget) setTruncation(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-truncation-title"
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-150"
          >
            <div className="p-6 bg-amber-50/70 border-b border-amber-100 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3
                    id="export-truncation-title"
                    className="font-display font-bold text-base text-[#1B2A4A] tracking-tight"
                  >
                    El reporte excede el límite
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Aviso previo a la descarga</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTruncation(null)}
                aria-label="Cerrar aviso"
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                El filtro actual arroja{" "}
                <span className="font-semibold text-slate-900">
                  {truncation.totalFiltrado.toLocaleString("es-DO")}
                </span>{" "}
                filas y el límite institucional es{" "}
                <span className="font-semibold text-slate-900">
                  {truncation.maxRows.toLocaleString("es-DO")}
                </span>
                . Se exportarán las primeras{" "}
                <span className="font-semibold text-slate-900">
                  {truncation.maxRows.toLocaleString("es-DO")}
                </span>{" "}
                filas con un aviso de truncamiento al final del archivo.
              </p>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setTruncation(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmTruncatedDownload}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#003D9B] hover:bg-[#002D72] rounded-xl transition-all shadow-xs active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Continuar y descargar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
