import { AlertTriangle, CheckCircle2, Clock3, Landmark } from "lucide-react";
import { formatCount, type AsientosKpis } from "./types";

interface KpiCardsProps {
  kpis: AsientosKpis | null;
  isLoading?: boolean;
}

const CARDS = [
  {
    key: "total",
    label: "Total de asientos",
    icon: Landmark,
    tone: "bg-[#003D9B]/10 text-[#003D9B]",
    accent: "text-[#1B2A4A]",
  },
  {
    key: "pendientes",
    label: "Pendientes de envío",
    icon: Clock3,
    tone: "bg-amber-50 text-amber-600",
    accent: "text-amber-600",
  },
  {
    key: "enviados",
    label: "Enviados a contabilidad",
    icon: CheckCircle2,
    tone: "bg-emerald-50 text-emerald-600",
    accent: "text-emerald-600",
  },
  {
    key: "errores",
    label: "Con error",
    icon: AlertTriangle,
    tone: "bg-rose-50 text-rose-600",
    accent: "text-rose-600",
  },
] as const;

export function KpiCards({ kpis, isLoading = false }: KpiCardsProps) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      aria-busy={isLoading}
      aria-live="polite"
    >
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.key}
            className="rounded-xl bg-white p-5 border border-slate-200/90 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-mono">
                {card.label}
              </p>
              <span className={`p-1.5 rounded-lg ${card.tone}`} aria-hidden="true">
                <Icon className="w-4 h-4" />
              </span>
            </div>

            {isLoading ? (
              <div
                className="mt-3 h-8 w-24 rounded-md bg-slate-100 animate-pulse"
                aria-hidden="true"
              />
            ) : (
              <p
                className={`mt-2 font-display font-bold text-2xl font-mono tabular-nums ${card.accent}`}
              >
                {kpis ? formatCount(kpis[card.key]) : "—"}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
