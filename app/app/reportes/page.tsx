import { Suspense } from "react";
import { InventarioContent } from "@/components/reportes/inventario-content";

function InventarioFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-40 rounded-2xl bg-[#F2F3FF] animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-white shadow-sm animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function ReportesInventarioPage() {
  return (
    <Suspense fallback={<InventarioFallback />}>
      <InventarioContent />
    </Suspense>
  );
}
