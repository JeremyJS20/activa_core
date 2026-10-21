import { FileSpreadsheet } from "lucide-react";

export default function ReportesInventarioPage() {
  return (
    <section
      aria-labelledby="reportes-inventario-title"
      className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(27,42,74,0.06),0_4px_12px_rgba(27,42,74,0.04)]"
    >
      <div className="px-6 py-10 flex flex-col items-center text-center gap-3">
        <span className="p-3 rounded-2xl bg-[#F2F3FF] text-[#003D9B]" aria-hidden="true">
          <FileSpreadsheet className="w-6 h-6" />
        </span>
        <h2 id="reportes-inventario-title" className="font-display font-bold text-lg text-[#1B2A4A]">
          Inventario de Activos
        </h2>
        <p className="text-sm text-slate-500 max-w-md">
          La consola de consulta multicriterio se habilita en la siguiente tarea de la Wave 3
          (filtros, KPIs, tabla paginada y exportación).
        </p>
      </div>
    </section>
  );
}
