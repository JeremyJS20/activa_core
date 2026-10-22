"use client";

import { useEffect, useState } from "react";
import { Filter, RotateCcw, Search } from "lucide-react";
import {
  ESTADOS_ACTIVO,
  type EstadoActivoFiltro,
  type ReportFilters,
} from "@/components/reportes/reportes-types";

interface CatalogoOption {
  id: string;
  descripcion: string;
}

interface FiltersToolbarProps {
  filters: ReportFilters;
  onChange: (patch: Partial<ReportFilters>) => void;
  onReset: () => void;
  isFetching?: boolean;
}

export function FiltersToolbar({ filters, onChange, onReset, isFetching = false }: FiltersToolbarProps) {
  const [departamentos, setDepartamentos] = useState<CatalogoOption[]>([]);
  const [tiposActivos, setTiposActivos] = useState<CatalogoOption[]>([]);

  // Catálogos maestros reales (Sub-01).
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [deptosRes, tiposRes] = await Promise.all([
          fetch("/api/departamentos?page=1&limit=100&estado=ACTIVO"),
          fetch("/api/tipos-activos?page=1&limit=100"),
        ]);

        if (!active) return;

        if (deptosRes.ok) {
          const json = await deptosRes.json();
          if (active) setDepartamentos(json.data ?? []);
        }
        if (tiposRes.ok) {
          const json = await tiposRes.json();
          if (active) setTiposActivos(json.data ?? []);
        }
      } catch (error) {
        console.error("[REPORTES_FILTROS] No se pudieron cargar los catálogos:", error);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const toggleEstado = (estado: EstadoActivoFiltro) => {
    const activo = filters.estados.includes(estado);
    const next = activo
      ? filters.estados.filter((e) => e !== estado)
      : [...filters.estados, estado];
    onChange({ estados: next });
  };

  const inputClass =
    "w-full rounded-xl bg-white px-3 py-2 text-sm text-[#1B2A4A] shadow-[inset_0_0_0_1px_rgba(27,42,74,0.08)] focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30";

  return (
    <section
      aria-labelledby="reportes-filtros-title"
      className="rounded-2xl bg-[#F2F3FF] p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="reportes-filtros-title"
          className="flex items-center gap-2 text-sm font-semibold text-[#1B2A4A]"
        >
          <Filter className="w-4 h-4 text-[#003D9B]" aria-hidden="true" />
          Filtros multicriterio
          {isFetching && (
            <span className="text-[11px] font-mono text-slate-500" aria-live="polite">
              Consultando…
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#505F76] shadow-[0_1px_2px_rgba(27,42,74,0.06)] hover:text-[#003D9B] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Restablecer filtros
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76]">
          Fecha desde
          <input
            type="date"
            value={filters.fechaInicio}
            onChange={(e) => onChange({ fechaInicio: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76]">
          Fecha hasta
          <input
            type="date"
            value={filters.fechaFin}
            onChange={(e) => onChange({ fechaFin: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76]">
          Monto mínimo (RD$)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={filters.montoMin}
            onChange={(e) => onChange({ montoMin: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76]">
          Monto máximo (RD$)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="Sin límite"
            value={filters.montoMax}
            onChange={(e) => onChange({ montoMax: e.target.value })}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76]">
          Departamento
          <select
            value={filters.departamentoId}
            onChange={(e) => onChange({ departamentoId: e.target.value })}
            className={inputClass}
          >
            <option value="">Todos los departamentos</option>
            {departamentos.map((depto) => (
              <option key={depto.id} value={depto.id}>
                {depto.descripcion}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76]">
          Tipo de activo
          <select
            value={filters.tipoActivoId}
            onChange={(e) => onChange({ tipoActivoId: e.target.value })}
            className={inputClass}
          >
            <option value="">Todos los tipos</option>
            {tiposActivos.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.descripcion}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76]">
          Custodio (nombre o cédula)
          <span className="relative block">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Ej: María o 001-1234567-8"
              value={filters.custodio}
              onChange={(e) => onChange({ custodio: e.target.value })}
              className={inputClass + " pl-9"}
            />
          </span>
        </label>

        <label className="space-y-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76]">
          Búsqueda (código, descripción o serial)
          <span className="relative block">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Ej: ACT-2026-0042"
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              className={inputClass + " pl-9"}
            />
          </span>
        </label>
      </div>

      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Estado del activo</legend>
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mr-1">
          Estado:
        </span>
        {ESTADOS_ACTIVO.map((estado) => {
          const activo = filters.estados.includes(estado.value);
          return (
            <button
              key={estado.value}
              type="button"
              aria-pressed={activo}
              onClick={() => toggleEstado(estado.value)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
                (activo
                  ? "bg-[#003D9B] text-white shadow-[0_1px_3px_rgba(0,61,155,0.35)]"
                  : "bg-white text-[#505F76] hover:text-[#1B2A4A]")
              }
            >
              {estado.label}
            </button>
          );
        })}
      </fieldset>
    </section>
  );
}
