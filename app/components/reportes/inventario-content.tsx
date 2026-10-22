"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { FiltersToolbar } from "@/components/reportes/filters-toolbar";
import { KpiCards } from "@/components/reportes/kpi-cards";
import { useDebouncedValue } from "@/components/reportes/use-debounced-value";
import {
  EMPTY_FILTERS,
  filtersToSearchParams,
  formatCount,
  searchParamsToFilters,
  type InventarioResponse,
  type ReportFilters,
} from "@/components/reportes/reportes-types";

export function InventarioContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryString = searchParams.toString();
  // Ventana de estabilización de 300 ms: el URL sigue siendo la fuente de verdad,
  // pero solo se consulta la API una vez consolidados los cambios (REQ-REP-001).
  const debouncedQuery = useDebouncedValue(queryString, 300);

  const filters = useMemo(
    () => searchParamsToFilters(new URLSearchParams(debouncedQuery)),
    [debouncedQuery]
  );

  const [data, setData] = useState<InventarioResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/reportes/inventario?${debouncedQuery}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const problem = await res.json().catch(() => null);
          const detail = problem?.errors
            ? Object.values(problem.errors as Record<string, string>)[0]
            : problem?.detail;
          throw new Error(detail || "No fue posible consultar el inventario.");
        }

        const json: InventarioResponse = await res.json();
        if (active) setData(json);
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
  }, [debouncedQuery]);

  const applyFilters = useCallback(
    (patch: Partial<ReportFilters>) => {
      const next: ReportFilters = { ...filters, ...patch };
      const params = filtersToSearchParams(next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, pathname, router]
  );

  const resetFilters = useCallback(() => {
    const params = filtersToSearchParams(EMPTY_FILTERS);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router]);

  const total = data?.meta.total ?? 0;
  const page = data?.meta.page ?? 1;
  const totalPages = data?.meta.totalPages ?? 0;
  const visible = data?.data.length ?? 0;

  return (
    <div className="space-y-6">
      <FiltersToolbar
        filters={filters}
        onChange={applyFilters}
        onReset={resetFilters}
        isFetching={isLoading}
      />

      <KpiCards kpis={data?.kpis ?? null} isLoading={isLoading} />

      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-3 rounded-2xl bg-[#FFDAD6]/50 p-4 text-sm text-[#93000A]"
        >
          <AlertCircle className="w-4 h-4 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : (
        <p className="text-xs font-mono text-slate-500" aria-live="polite">
          {isLoading
            ? "Consultando inventario…"
            : `Mostrando ${formatCount(visible)} de ${formatCount(total)} activos · página ${page}${
                totalPages > 0 ? ` de ${totalPages}` : ""
              }`}
        </p>
      )}
    </div>
  );
}
