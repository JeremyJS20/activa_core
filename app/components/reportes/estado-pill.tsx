interface EstadoPillProps {
  estado: string;
}

const ESTADO_STYLES: Record<string, { label: string; className: string; dot: string }> = {
  ACTIVO: {
    label: "Activo",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    dot: "bg-emerald-600",
  },
  EN_MANTENIMIENTO: {
    label: "En mantenimiento",
    className: "bg-amber-50 text-amber-700 border-amber-200/60",
    dot: "bg-amber-500",
  },
  DADO_DE_BAJA: {
    label: "Dado de baja",
    className: "bg-rose-50 text-rose-700 border-rose-200/60",
    dot: "bg-rose-500",
  },
  VENDIDO: {
    label: "Vendido",
    className: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
};

export function EstadoPill({ estado }: EstadoPillProps) {
  const config =
    ESTADO_STYLES[estado] ?? {
      label: estado.replace(/_/g, " ").toLowerCase(),
      className: "bg-slate-100 text-slate-600 border-slate-200",
      dot: "bg-slate-400",
    };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}
