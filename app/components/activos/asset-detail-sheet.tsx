"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  DollarSign,
  Edit3,
  Hash,
  History,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  Package,
  Palette,
  Tag,
  User,
  X,
} from "lucide-react";
import type { AssetRow } from "@/components/activos/asset-table";

interface HistorialBajaDetalle {
  id: string;
  motivoBaja: string;
  justificacion: string;
  numeroActa: string;
  fechaBaja: string;
  valorEnLibrosAlBaja: number;
  createdAt: string;
}

interface AssetDetalle extends AssetRow {
  tipoActivo: AssetRow["tipoActivo"] & {
    cuentaContableCompra: string;
    cuentaContableDepreciacion: string;
  };
  historialBaja: HistorialBajaDetalle | null;
  poseeHistorialDepreciacion: boolean;
}

interface AssetDetailSheetProps {
  asset: AssetRow;
  onClose: () => void;
  onEdit?: (asset: AssetRow) => void;
  canEdit?: boolean;
}

const formatCurrency = (valor: number | null | undefined) =>
  Number(valor ?? 0).toLocaleString("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatFecha = (valor: string | null | undefined) => {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
};

const sinValor = (valor: string | null | undefined) =>
  valor && String(valor).trim() !== "" ? valor : "—";

function EstadoPill({ estado }: { estado: AssetRow["estado"] }) {
  switch (estado) {
    case "ACTIVO":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Activo
        </span>
      );
    case "EN_MANTENIMIENTO":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          En mantenimiento
        </span>
      );
    case "DADO_DE_BAJA":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Dado de baja
        </span>
      );
    case "VENDIDO":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Vendido
        </span>
      );
    default:
      return <span className="text-xs">{estado}</span>;
  }
}

function Dato({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
        {label}
      </dt>
      <dd
        className={`text-xs text-slate-700 ${mono ? "font-mono font-medium text-slate-800" : ""}`}
      >
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}

export function AssetDetailSheet({ asset, onClose, onEdit, canEdit = false }: AssetDetailSheetProps) {
  const [detalle, setDetalle] = useState<AssetDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const assetId = asset.id;

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const res = await fetch(`/api/activos/${assetId}`);
        const body = await res.json().catch(() => null);
        if (!activo) return;

        if (!res.ok) {
          setError(
            body?.message || body?.error || "No fue posible cargar la ficha técnica del activo."
          );
          return;
        }

        setDetalle(body as AssetDetalle);
      } catch {
        if (activo) setError("No fue posible comunicarse con el servidor.");
      } finally {
        if (activo) setIsLoading(false);
      }
    }

    void cargar();
    return () => {
      activo = false;
    };
  }, [assetId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const ficha = detalle ?? (asset as AssetDetalle);
  const totalDepreciado =
    ficha.costoAdquisicion > 0
      ? Math.min(100, (ficha.depreciacionAcumulada / ficha.costoAdquisicion) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <button
        type="button"
        aria-label="Cerrar ficha técnica"
        onClick={onClose}
        className="flex-1 cursor-default"
        tabIndex={-1}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-ficha-activo"
        className="w-full max-w-2xl bg-[#F9F9FF] h-full shadow-2xl border-l border-slate-200/80 flex flex-col animate-in slide-in-from-right duration-200"
      >
        <div className="p-6 bg-white border-b border-slate-200/80 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003D9B] text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="titulo-ficha-activo"
                  className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight"
                >
                  Ficha Técnica del Activo
                </h2>
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#003D9B]/10 text-[#003D9B] border border-[#003D9B]/20">
                  {ficha.codigo}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consulta de solo lectura · Identificación, situación fiscal y custodia
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar ficha técnica"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#003D9B]" />
              Cargando ficha del activo...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {!isLoading && !error && (
            <>
              <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-sm text-[#1B2A4A]">
                    Identificación del bien
                  </h3>
                  <EstadoPill estado={ficha.estado} />
                </div>
                <p className="text-sm font-semibold text-slate-800 leading-snug">
                  {ficha.descripcion}
                </p>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
                  <Dato label="Marca" value={sinValor(ficha.marca)} />
                  <Dato label="Modelo" value={sinValor(ficha.modelo)} />
                  <Dato label="Color" value={sinValor(ficha.color)} />
                  <Dato label="Número de serie" value={sinValor(ficha.numeroSerie)} mono />
                  <Dato
                    label="Fecha de adquisición"
                    value={formatFecha(ficha.fechaAdquisicion)}
                    mono
                  />
                  <Dato label="Ubicación física" value={sinValor(ficha.ubicacionFisica)} />
                </dl>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#003D9B]" />
                  <h3 className="font-display font-bold text-sm text-[#1B2A4A]">
                    Situación financiera
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                      Costo de adquisición
                    </span>
                    <p className="font-mono font-bold text-base text-slate-900 mt-0.5">
                      {formatCurrency(ficha.costoAdquisicion)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                      Valor residual
                    </span>
                    <p className="font-mono font-bold text-base text-slate-900 mt-0.5">
                      {formatCurrency(ficha.valorResidual)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                      Depreciación acumulada
                    </span>
                    <p className="font-mono font-bold text-base text-amber-700 mt-0.5">
                      {formatCurrency(ficha.depreciacionAcumulada)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                      Valor en libros
                    </span>
                    <p className="font-mono font-bold text-base text-[#003D9B] mt-0.5">
                      {formatCurrency(ficha.valorEnLibros)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Avance de depreciación</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {totalDepreciado.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#003D9B] rounded-full transition-all"
                      style={{ width: `${totalDepreciado}%` }}
                    />
                  </div>
                </div>

                {ficha.poseeHistorialDepreciacion && (
                  <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-lg flex items-start gap-2 text-[11px] text-amber-900">
                    <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Bloqueo financiero activo: el activo ya registra depreciación o fue
                      desincorporado. Costo, valor residual, fecha de adquisición y tipo de activo no
                      son editables.
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-[#003D9B]" />
                  <h3 className="font-display font-bold text-sm text-[#1B2A4A]">
                    Clasificación fiscal DGII
                  </h3>
                </div>
                <dl className="grid grid-cols-2 gap-4">
                  <Dato
                    label="Tipo de activo"
                    value={`${ficha.tipoActivo.codigo} · ${ficha.tipoActivo.descripcion}`}
                  />
                  <Dato
                    label="Tasa anual"
                    value={`${ficha.tipoActivo.porcentajeDepreciacionAnual.toFixed(2)}%`}
                    mono
                  />
                  <Dato
                    label="Cuenta de compra"
                    value={ficha.tipoActivo.cuentaContableCompra ?? "—"}
                    mono
                  />
                  <Dato
                    label="Cuenta de depreciación acumulada"
                    value={ficha.tipoActivo.cuentaContableDepreciacion ?? "—"}
                    mono
                  />
                </dl>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#003D9B]" />
                  <h3 className="font-display font-bold text-sm text-[#1B2A4A]">
                    Custodia y adscripción
                  </h3>
                </div>
                <dl className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                        Departamento
                      </dt>
                      <dd className="text-xs text-slate-700">
                        <span className="font-mono font-medium">{ficha.departamento.codigo}</span> ·{" "}
                        {ficha.departamento.descripcion}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                        Custodio responsable
                      </dt>
                      <dd className="text-xs text-slate-700">
                        {ficha.empleado.nombre} {ficha.empleado.apellido}
                        {ficha.empleado.cargo ? ` · ${ficha.empleado.cargo}` : ""}
                      </dd>
                      <dd className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {ficha.empleado.codigo} · {ficha.empleado.cedula}
                      </dd>
                    </div>
                  </div>
                </dl>
              </div>

              {ficha.historialBaja && (
                <div className="bg-white rounded-xl p-5 border border-rose-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-rose-600" />
                    <h3 className="font-display font-bold text-sm text-rose-950">
                      Desincorporación formal
                    </h3>
                  </div>
                  <dl className="grid grid-cols-2 gap-4">
                    <Dato label="Motivo" value={ficha.historialBaja.motivoBaja} />
                    <Dato
                      label="Acta"
                      value={ficha.historialBaja.numeroActa}
                      mono
                    />
                    <Dato
                      label="Fecha de baja"
                      value={formatFecha(ficha.historialBaja.fechaBaja)}
                      mono
                    />
                    <Dato
                      label="Valor en libros al momento de la baja"
                      value={formatCurrency(ficha.historialBaja.valorEnLibrosAlBaja)}
                      mono
                    />
                  </dl>
                  <p className="text-[11px] text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    {ficha.historialBaja.justificacion}
                  </p>
                </div>
              )}

              <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
                <dl className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <Dato label="Registrado" value={formatFecha(ficha.createdAt)} mono />
                  </div>
                  <div className="flex items-start gap-2">
                    <History className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <Dato label="Última actualización" value={formatFecha(ficha.updatedAt)} mono />
                  </div>
                </dl>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                  <span className="inline-flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {ficha.id}
                  </span>
                  {ficha.color ? (
                    <span className="inline-flex items-center gap-1">
                      <Palette className="w-3 h-3" />
                      {ficha.color}
                    </span>
                  ) : null}
                  {ficha.ubicacionFisica ? (
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3" />
                      {ficha.ubicacionFisica}
                    </span>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200/80 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <Tag className="w-3.5 h-3.5" />
            Solo consulta
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(asset)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar activo
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
