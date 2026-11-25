"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Landmark, ShieldCheck } from "lucide-react";
import { AsientosTable } from "./asientos-table";
import { KpiCards } from "./kpi-cards";
import {
  contabilidadQueryToApiParams,
  contabilidadQueryToSearchParams,
  parseContabilidadQuery,
  type AsientosResponse,
  type ContabilidadQuery,
  type ProblemDetails,
} from "./types";

function mensajeDeError(problem: ProblemDetails | null): string {
  if (!problem) return "No fue posible consultar los asientos contables.";
  if (Array.isArray(problem.errors)) {
    const primero = problem.errors[0]?.message;
    if (primero) return primero;
  } else if (problem.errors) {
    const primero = Object.values(problem.errors)[0];
    if (primero) return primero;
  }
  return (
    problem.detail ||
    problem.message ||
    problem.title ||
    "No fue posible consultar los asientos contables."
  );
}

export function ContabilidadContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const queryString = searchParams.toString();
  const query = useMemo(
    () => parseContabilidadQuery(new URLSearchParams(queryString)),
    [queryString]
  );

  const [data, setData] = useState<AsientosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const permisos = session?.user?.permisos ?? [];
  const isSuperAdmin =
    session?.user?.rol?.codigo === "ADMIN" || permisos.includes("USER_ADMIN");
  const canManage =
    Boolean(session?.user) &&
    (isSuperAdmin || permisos.includes("INT_MANAGE") || permisos.includes("ACC_POST_SEND"));

  const replaceQuery = useCallback(
    (next: ContabilidadQuery) => {
      const qs = contabilidadQueryToSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const updateQuery = useCallback(
    (patch: Partial<ContabilidadQuery>) => {
      const next: ContabilidadQuery = { ...query, ...patch };
      if (!("page" in patch)) next.page = 1;
      if (next.page < 1) next.page = 1;
      replaceQuery(next);
    },
    [query, replaceQuery]
  );

  const resetQuery = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const params = contabilidadQueryToApiParams(query);
        const res = await fetch(`/api/contabilidad/asientos?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
          throw new Error(mensajeDeError(problem));
        }

        const json = (await res.json()) as AsientosResponse;
        if (!active) return;

        setData(json);

        // Clamp si el resultset se reduce entre consultas (p. ej. tras un filtro).
        if (json.meta.totalPages > 0 && query.page > json.meta.totalPages) {
          replaceQuery({ ...query, page: json.meta.totalPages });
        }
      } catch (err) {
        if (!active || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(
          err instanceof Error
            ? err.message
            : "Error inesperado al consultar los asientos contables."
        );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [query, refreshKey, replaceQuery]);

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#003D9B] uppercase tracking-wider font-mono mb-1">
              <Landmark className="w-4 h-4" aria-hidden="true" />
              <span>Gestión de Activos · Integración</span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
              Integración Contable
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Monitoreo y despacho de los asientos de depreciación hacia el Web Service de
              Contabilidad institucional.
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full text-xs font-semibold border font-mono whitespace-nowrap ${
              canManage
                ? "bg-[#003D9B]/5 text-[#003D9B] border-[#003D9B]/20"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            {canManage ? "Operador contable" : "Solo lectura / auditoría"}
          </span>
        </div>

        <KpiCards kpis={data?.kpis ?? null} isLoading={isLoading} />

        <AsientosTable
          rows={data?.data ?? []}
          isLoading={isLoading}
          error={error}
          totalCount={data?.meta.total ?? 0}
          page={data?.meta.page ?? query.page}
          pageSize={data?.meta.pageSize ?? query.pageSize}
          totalPages={data?.meta.totalPages ?? 1}
          query={query}
          onQueryChange={updateQuery}
          onReset={resetQuery}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
}
