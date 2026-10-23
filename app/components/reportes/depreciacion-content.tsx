"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ReportDataTable } from "@/components/reportes/report-data-table";
import { useDebouncedValue } from "@/components/reportes/use-debounced-value";
import {
  formatRD,
  type DepreciacionResponse,
  type DepreciacionRow,
} from "@/components/reportes/reportes-types";

interface DepreciacionContentProps {
  /** Período resuelto en el servidor: mes actual con datos o el último período con cuotas. */
  periodoInicial: string;
  /** Períodos con cuotas registradas, orden descendente (para la leyenda informativa). */
  periodosDisponibles: string[];
}

interface DepreciacionFilters {
  periodo: string;
  cuentaCompra: string;
  cuentaDepreciacion: string;
}

interface TipoActivoCuentas {
  cuentaContableCompra?: string | null;
  cuentaContableDepreciacion?: string | null;
}

const PAGE_SIZE_DEFAULT = 10;
const NOOP = () => {};

/** Vida útil legible: años exactos o meses. */
function formatVidaUtil(meses: number | null): string {
  if (!meses || meses <= 0) return "—";
  if (meses % 12 === 0) {
    const anios = meses / 12;
    return `${anios} ${anios === 1 ? "año" : "años"}`;
  }
  return `${meses} meses`;
}

export function DepreciacionContent({
  periodoInicial,
  periodosDisponibles,
}: DepreciacionContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryString = searchParams.toString();
  // Ventana de estabilización de 300ms: el URL es la fuente de verdad, pero la
  // API solo se consulta una vez consolidados los cambios de filtros.
  const debouncedQuery = useDebouncedValue(queryString, 300);

  // Valores "vivos" para los controles (respuesta inmediata al usuario).
  const liveParams = useMemo(() => new URLSearchParams(queryString), [queryString]);
  // Valores estabilizados para la consulta y el render de la tabla.
  const stableParams = useMemo(() => new URLSearchParams(debouncedQuery), [debouncedQuery]);

  const periodoValue = liveParams.get("periodo") || periodoInicial;
  const cuentaCompraValue = liveParams.get("cuentaCompra") ?? "";
  const cuentaDepreciacionValue = liveParams.get("cuentaDepreciacion") ?? "";

  const periodo = stableParams.get("periodo") || periodoInicial;
  const cuentaCompra = stableParams.get("cuentaCompra") ?? "";
  const cuentaDepreciacion = stableParams.get("cuentaDepreciacion") ?? "";
  const requestedPage = Number(stableParams.get("page") ?? "1") || 1;
  const requestedLimit = Number(stableParams.get("pageSize") ?? String(PAGE_SIZE_DEFAULT)) || PAGE_SIZE_DEFAULT;

  const [data, setData] = useState<DepreciacionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cuentasCompra, setCuentasCompra] = useState<string[]>([]);
  const [cuentasDepreciacion, setCuentasDepreciacion] = useState<string[]>([]);

  const replaceQuery = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  // Canonicaliza el URL cuando se entra sin período explícito (default del servidor).
  useEffect(() => {
    if (liveParams.get("periodo")) return;
    const params = new URLSearchParams(liveParams.toString());
    params.set("periodo", periodoInicial);
    replaceQuery(params);
  }, [liveParams, periodoInicial, replaceQuery]);

  // Consulta del reporte de depreciación (REQ-REP-004).
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("periodo", periodo);
        if (cuentaCompra) params.set("cuentaCompra", cuentaCompra);
        if (cuentaDepreciacion) params.set("cuentaDepreciacion", cuentaDepreciacion);
        params.set("page", String(requestedPage));
        params.set("pageSize", String(requestedLimit));

        const res = await fetch(`/api/reportes/depreciacion?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const problem = await res.json().catch(() => null);
          const detail = problem?.errors
            ? Object.values(problem.errors as Record<string, string>)[0]
            : problem?.detail;
          throw new Error(detail || "No fue posible consultar la depreciación.");
        }

        const json: DepreciacionResponse = await res.json();
        if (!active) return;

        setData(json);
        // Clamp de página si el resultset se reduce entre consultas.
        if (
          json.meta.totalPages > 0 &&
          requestedPage > json.meta.totalPages &&
          json.meta.page !== requestedPage
        ) {
          const next = new URLSearchParams(stableParams.toString());
          next.set("page", String(json.meta.totalPages));
          replaceQuery(next);
        }
      } catch (err) {
        if (!active || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Error inesperado al consultar.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    periodo,
    cuentaCompra,
    cuentaDepreciacion,
    requestedPage,
    requestedLimit,
    stableParams,
    replaceQuery,
  ]);

  // Cuentas contables sugeridas desde el catálogo real de tipos de activo (Sub-01).
  useEffect(() => {
    let active = true;

    async function loadCuentas() {
      try {
        const res = await fetch("/api/tipos-activos?page=1&limit=100");
        if (!res.ok || !active) return;
        const json = (await res.json()) as { data?: TipoActivoCuentas[] };

        const compras = new Set<string>();
        const depreciaciones = new Set<string>();
        for (const tipo of json.data ?? []) {
          if (tipo.cuentaContableCompra) compras.add(tipo.cuentaContableCompra);
          if (tipo.cuentaContableDepreciacion) depreciaciones.add(tipo.cuentaContableDepreciacion);
        }

        if (!active) return;
        setCuentasCompra([...compras].sort());
        setCuentasDepreciacion([...depreciaciones].sort());
      } catch (err) {
        console.error("[REPORTES_DEPRECIACION] No se pudieron cargar las cuentas contables:", err);
      }
    }

    loadCuentas();
    return () => {
      active = false;
    };
  }, []);

  // Ref sincrónico: evita merges stale mientras `router.replace` propaga el querystring.
  const filtersRef = useRef<DepreciacionFilters>({
    periodo: periodoValue,
    cuentaCompra: cuentaCompraValue,
    cuentaDepreciacion: cuentaDepreciacionValue,
  });

  useEffect(() => {
    filtersRef.current = {
      periodo: liveParams.get("periodo") || periodoInicial,
      cuentaCompra: liveParams.get("cuentaCompra") ?? "",
      cuentaDepreciacion: liveParams.get("cuentaDepreciacion") ?? "",
    };
  }, [liveParams, periodoInicial]);

  // Cambiar cualquier filtro reinicia a la página 1 (patrón de catálogos).
  const applyFilters = useCallback(
    (patch: Partial<DepreciacionFilters>) => {
      const next: DepreciacionFilters = { ...filtersRef.current, ...patch };
      filtersRef.current = next;

      const params = new URLSearchParams();
      params.set("periodo", next.periodo || periodoInicial);
      if (next.cuentaCompra) params.set("cuentaCompra", next.cuentaCompra);
      if (next.cuentaDepreciacion) params.set("cuentaDepreciacion", next.cuentaDepreciacion);
      if (requestedLimit !== PAGE_SIZE_DEFAULT) params.set("pageSize", String(requestedLimit));
      replaceQuery(params);
    },
    [periodoInicial, requestedLimit, replaceQuery]
  );

  const resetFilters = useCallback(() => {
    replaceQuery(new URLSearchParams());
  }, [replaceQuery]);

  const changePage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams();
      params.set("periodo", filtersRef.current.periodo || periodoInicial);
      if (filtersRef.current.cuentaCompra) params.set("cuentaCompra", filtersRef.current.cuentaCompra);
      if (filtersRef.current.cuentaDepreciacion) {
        params.set("cuentaDepreciacion", filtersRef.current.cuentaDepreciacion);
      }
      if (nextPage > 1) params.set("page", String(nextPage));
      if (requestedLimit !== PAGE_SIZE_DEFAULT) params.set("pageSize", String(requestedLimit));
      replaceQuery(params);
    },
    [periodoInicial, requestedLimit, replaceQuery]
  );

  const rows: DepreciacionRow[] = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const page = data?.meta.page ?? requestedPage;
  const totalPages = data?.meta.totalPages ?? 0;
  const totales = data?.totales;
  const periodoServidor = data?.meta.periodo ?? periodoValue;

  const filtraCuentas = Boolean(cuentaCompraValue || cuentaDepreciacionValue);
  const emptyTitle =
    total === 0 && !filtraCuentas
      ? `No existe depreciación procesada para el período ${periodoServidor}`
      : "No hay cuotas para los filtros seleccionados";
  const emptyDescription =
    total === 0 && !filtraCuentas
      ? "El período seleccionado aún no tiene cuotas de depreciación registradas. Seleccione otro período o restablezca los filtros."
      : "Ninguna cuota del período coincide con las cuentas contables seleccionadas. Ajuste los criterios o restablezca la consulta.";

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium bg-rose-50 border-rose-200 text-rose-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <ReportDataTable
        title="Depreciación Fiscal por Período"
        reporteKey="depreciacion"
        subtitle="Cuotas registradas por período fiscal, con acumulado histórico y valor en libros al corte."
        showSearch={false}
        searchValue=""
        onSearchChange={NOOP}
        onRefresh={() => replaceQuery(new URLSearchParams(queryString))}
        isLoading={isLoading}
        totalCount={total}
        page={page}
        limit={data?.meta.pageSize ?? requestedLimit}
        totalPages={totalPages}
        onPageChange={changePage}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        onResetEmpty={resetFilters}
        filters={
          <div className="flex items-center gap-3 flex-wrap">
            {/* Período fiscal YYYY-MM (REQ-REP-004) */}
            <label className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 font-mono">Período:</span>
              <input
                type="month"
                value={periodoValue}
                onChange={(e) => {
                  if (!e.target.value) return;
                  applyFilters({ periodo: e.target.value });
                }}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors"
              />
            </label>

            {/* Cuenta contable de compra */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-500 font-mono">Cta. compra:</label>
              <select
                value={cuentaCompraValue}
                onChange={(e) => applyFilters({ cuentaCompra: e.target.value })}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors max-w-[170px] truncate"
              >
                <option value="">Todas las cuentas</option>
                {cuentaCompraValue && !cuentasCompra.includes(cuentaCompraValue) && (
                  <option value={cuentaCompraValue}>{cuentaCompraValue}</option>
                )}
                {cuentasCompra.map((cuenta) => (
                  <option key={cuenta} value={cuenta}>
                    {cuenta}
                  </option>
                ))}
              </select>
            </div>

            {/* Cuenta contable de depreciación */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-500 font-mono">Cta. dep.:</label>
              <select
                value={cuentaDepreciacionValue}
                onChange={(e) => applyFilters({ cuentaDepreciacion: e.target.value })}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors max-w-[170px] truncate"
              >
                <option value="">Todas las cuentas</option>
                {cuentaDepreciacionValue && !cuentasDepreciacion.includes(cuentaDepreciacionValue) && (
                  <option value={cuentaDepreciacionValue}>{cuentaDepreciacionValue}</option>
                )}
                {cuentasDepreciacion.map((cuenta) => (
                  <option key={cuenta} value={cuenta}>
                    {cuenta}
                  </option>
                ))}
              </select>
            </div>

            {periodosDisponibles.length > 0 && (
              <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                Con datos: {periodosDisponibles.slice(0, 3).join(" · ")}
              </span>
            )}
          </div>
        }
      >
        <table className="w-full text-left text-xs sm:text-sm">
          <caption className="sr-only">
            Depreciación fiscal del período {periodoServidor}
          </caption>
          <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
            <tr>
              <th className="px-5 py-3">Código</th>
              <th className="px-5 py-3">Descripción / Activo</th>
              <th className="px-5 py-3 text-center">Vida útil</th>
              <th className="px-5 py-3 text-right">Costo original</th>
              <th className="px-5 py-3 text-right">Cuota del mes</th>
              <th className="px-5 py-3 text-right">Dep. acumulada</th>
              <th className="px-5 py-3 text-right">Valor en libros</th>
              <th className="px-5 py-3">Cuentas contables</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.activoId} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/60">
                    {row.codigo}
                  </span>
                </td>

                <td className="px-5 py-3.5">
                  <div className="font-semibold text-slate-900 leading-tight">{row.descripcion}</div>
                </td>

                <td className="px-5 py-3.5 text-center whitespace-nowrap font-mono text-xs text-slate-600">
                  {formatVidaUtil(row.vidaUtilMeses)}
                </td>

                <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono tabular-nums text-slate-700">
                  {formatRD(row.costoOriginal)}
                </td>

                <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono tabular-nums text-slate-800">
                  {formatRD(row.cuotaMes)}
                </td>

                <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono tabular-nums text-slate-700">
                  {formatRD(row.depreciacionAcumuladaHistorica)}
                </td>

                <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono tabular-nums font-semibold text-slate-900">
                  {formatRD(row.valorEnLibros)}
                </td>

                <td className="px-5 py-3.5 whitespace-nowrap">
                  <div className="font-mono text-[11px] text-slate-600 leading-tight">
                    <span className="text-slate-400">C:</span> {row.cuentaCompra}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 leading-tight mt-0.5">
                    <span className="text-slate-300">D:</span> {row.cuentaDepreciacion}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && totales && (
            <tfoot className="bg-slate-50/80 border-t border-slate-200/80">
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono"
                >
                  Totales del período {periodoServidor}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap font-mono tabular-nums font-semibold text-slate-900">
                  {formatRD(totales.cuotaTotalMes)}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap font-mono tabular-nums font-semibold text-slate-900">
                  {formatRD(totales.depreciacionAcumuladaTotal)}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap font-mono tabular-nums font-semibold text-slate-900">
                  {formatRD(totales.valorEnLibrosTotal)}
                </td>
                <td className="px-5 py-3" aria-hidden="true" />
              </tr>
            </tfoot>
          )}
        </table>
      </ReportDataTable>
    </div>
  );
}
