"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CheckCircle2,
  Landmark,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { AsientoDetailSheet } from "./asiento-detail-sheet";
import { AsientosTable } from "./asientos-table";
import { BatchDispatchDialog } from "./batch-dispatch-dialog";
import { KpiCards } from "./kpi-cards";
import {
  contabilidadQueryToApiParams,
  contabilidadQueryToSearchParams,
  mensajeDeErrorIntegracion,
  parseContabilidadQuery,
  type AccionAsientoResponse,
  type AsientoListado,
  type AsientosResponse,
  type ContabilidadQuery,
  type ProblemDetails,
} from "./types";

type Toast = { type: "success" | "error"; text: string };

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

  const [selectedAsientoId, setSelectedAsientoId] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const permisos = session?.user?.permisos ?? [];
  const isSuperAdmin =
    session?.user?.rol?.codigo === "ADMIN" || permisos.includes("USER_ADMIN");
  const canManage =
    Boolean(session?.user) &&
    (isSuperAdmin || permisos.includes("INT_MANAGE") || permisos.includes("ACC_POST_SEND"));
  const canReadLog =
    Boolean(session?.user) && (isSuperAdmin || permisos.includes("ACC_LOG_READ"));

  const notify = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
          throw new Error(
            mensajeDeErrorIntegracion(
              problem,
              "No fue posible consultar los asientos contables."
            )
          );
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

  const ejecutarAccionFila = useCallback(
    async (asiento: AsientoListado, tipo: "despachar" | "reintentar") => {
      setAccionEnCurso(`${asiento.id}:${tipo}`);
      try {
        const res = await fetch(`/api/contabilidad/asientos/${asiento.id}/${tipo}`, {
          method: "POST",
        });
        const json = (await res.json().catch(() => null)) as
          | AccionAsientoResponse
          | ProblemDetails
          | null;

        if (!res.ok) {
          notify(
            "error",
            mensajeDeErrorIntegracion(
              json as ProblemDetails | null,
              `No fue posible ${tipo === "despachar" ? "despachar" : "reintentar"} el asiento (HTTP ${res.status}).`
            )
          );
          return;
        }

        const data = (json as AccionAsientoResponse).data;
        notify(
          "success",
          `Asiento ${data.numeroAsiento} ${data.estado === "ENVIADO" ? "enviado" : "actualizado"} correctamente (intento ${data.intento}).`
        );
        refresh();
      } catch {
        notify("error", "No fue posible comunicarse con el servidor. Intente nuevamente.");
      } finally {
        setAccionEnCurso(null);
      }
    },
    [notify, refresh]
  );

  const cerrarDetalle = useCallback(() => setSelectedAsientoId(null), []);
  const cerrarLote = useCallback(() => setBatchOpen(false), []);

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {toast && (
          <div
            role={toast.type === "error" ? "alert" : "status"}
            aria-live="polite"
            className={`fixed bottom-6 right-6 z-[70] px-4 py-3 rounded-xl shadow-lg border flex items-start gap-3 text-sm animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span className="font-medium flex-1">{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Cerrar notificación"
              className="text-current/70 hover:text-current"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
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

          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-end xl:items-center gap-2.5 self-start">
            {canManage && (data?.kpis.pendientes ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setBatchOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] shadow-xs transition-all whitespace-nowrap"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                Despachar Pendientes en Lote
              </button>
            )}

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border font-mono whitespace-nowrap ${
                canManage
                  ? "bg-[#003D9B]/5 text-[#003D9B] border-[#003D9B]/20"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              {canManage ? "Operador contable" : "Solo lectura / auditoría"}
            </span>
          </div>
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
          onVer={(asiento) => setSelectedAsientoId(asiento.id)}
          canManage={canManage}
          onAccion={(asiento, tipo) => void ejecutarAccionFila(asiento, tipo)}
          accionEnCurso={accionEnCurso}
        />
      </div>

      {selectedAsientoId && (
        <AsientoDetailSheet
          asientoId={selectedAsientoId}
          canManage={canManage}
          canReadLog={canReadLog}
          onClose={cerrarDetalle}
          onMutated={refresh}
          onNotify={notify}
        />
      )}

      {batchOpen && (
        <BatchDispatchDialog
          periodo={query.periodo}
          pendientes={data?.kpis.pendientes ?? 0}
          onClose={cerrarLote}
          onCompleted={() => refresh()}
          onNotify={notify}
        />
      )}
    </div>
  );
}
