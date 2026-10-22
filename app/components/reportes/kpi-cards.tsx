import { Coins, Landmark, PackageSearch, TrendingDown } from "lucide-react";
import { formatCount, formatRD, type InventarioKpis } from "@/components/reportes/reportes-types";

interface KpiCardsProps {
  kpis: InventarioKpis | null;
  isLoading?: boolean;
}

const CARDS = [
  {
    key: "cantidadActivos",
    label: "Activos en el filtro",
    icon: PackageSearch,
    format: (kpis: InventarioKpis) => formatCount(kpis.cantidadActivos),
  },
  {
    key: "costoTotalAdquisicion",
    label: "Costo total de adquisición",
    icon: Coins,
    format: (kpis: InventarioKpis) => formatRD(kpis.costoTotalAdquisicion),
  },
  {
    key: "depreciacionAcumulada",
    label: "Depreciación acumulada",
    icon: TrendingDown,
    format: (kpis: InventarioKpis) => formatRD(kpis.depreciacionAcumulada),
  },
  {
    key: "valorEnLibrosTotal",
    label: "Valor neto en libros",
    icon: Landmark,
    format: (kpis: InventarioKpis) => formatRD(kpis.valorEnLibrosTotal),
  },
] as const;

export function KpiCards({ kpis, isLoading = false }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-busy={isLoading}>
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.key}
            className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(27,42,74,0.06),0_4px_12px_rgba(27,42,74,0.04)]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76]">
                {card.label}
              </p>
              <span className="p-1.5 rounded-lg bg-[#F2F3FF] text-[#003D9B]" aria-hidden="true">
                <Icon className="w-4 h-4" />
              </span>
            </div>

            {isLoading ? (
              <div
                className="mt-3 h-8 w-32 rounded-md bg-slate-100 animate-pulse"
                aria-hidden="true"
              />
            ) : (
              <p className="mt-2 font-display font-extrabold text-2xl text-[#1B2A4A] font-mono tabular-nums">
                {kpis ? card.format(kpis) : "—"}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
