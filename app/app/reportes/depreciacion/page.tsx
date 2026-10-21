import { TrendingDown } from "lucide-react";

export default function ReportesDepreciacionPage() {
  return (
    <section
      aria-labelledby="reportes-depreciacion-title"
      className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(27,42,74,0.06),0_4px_12px_rgba(27,42,74,0.04)]"
    >
      <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
        <span className="p-3 rounded-2xl bg-[#F2F3FF] text-[#003D9B]" aria-hidden="true">
          <TrendingDown className="w-6 h-6" />
        </span>
        <h2
          id="reportes-depreciacion-title"
          className="font-display font-bold text-lg text-[#1B2A4A]"
        >
          Depreciación Fiscal
        </h2>
        <p className="text-sm text-slate-500 max-w-md">
          El reporte por período fiscal se habilita en la Task 3.4 de la Wave 3.
        </p>
      </div>
    </section>
  );
}
