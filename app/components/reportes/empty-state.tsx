import { FolderSearch } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  onReset?: () => void;
}

export function EmptyState({
  title = "No se encontraron activos",
  description = "No hay activos que coincidan con los criterios de búsqueda o filtros seleccionados.",
  onReset,
}: EmptyStateProps) {
  return (
    <div className="p-12 text-center">
      <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
        <FolderSearch className="w-6 h-6 text-slate-400" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-slate-800 font-display">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">{description}</p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#003D9B] bg-[#003D9B]/10 hover:bg-[#003D9B]/20 rounded-md transition-colors"
        >
          Restablecer filtros
        </button>
      )}
    </div>
  );
}
