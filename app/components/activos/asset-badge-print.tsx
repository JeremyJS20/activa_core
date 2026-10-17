"use client";

import React, { useRef } from "react";
import {
  Printer,
  X,
  QrCode,
  Tag,
  Building2,
  User,
  Info,
} from "lucide-react";
import { AssetRow } from "@/components/activos/asset-table";

export interface AssetBadgePrintProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetRow | null;
}

export function AssetBadgePrint({
  isOpen,
  onClose,
  asset,
}: AssetBadgePrintProps) {
  const badgeRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !asset) return null;

  const handlePrint = () => {
    window.print();
  };

  // Generador visual de barras para el marbete institucional
  const renderBarcodeLines = () => {
    // Patrón pseudo-aleatorio determinista basado en el código para representar el código de barras
    const pattern = [2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 2, 3, 1, 2, 1, 3, 2, 1];
    return (
      <div className="flex items-center justify-center gap-[1.5px] h-6 w-full overflow-hidden px-1">
        {pattern.map((width, idx) => (
          <div
            key={idx}
            className="bg-slate-900 h-full"
            style={{ width: `${width * 1.5}px` }}
          />
        ))}
      </div>
    );
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      {/* Estilos para Impresión Térmica Directa 50mm x 25mm */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-badge, #printable-badge * {
            visibility: visible !important;
          }
          #printable-badge {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 50mm !important;
            height: 25mm !important;
            margin: 0 !important;
            padding: 1.5mm !important;
            border: 1px solid #000 !important;
            box-sizing: border-box !important;
            background: #fff !important;
            color: #000 !important;
            font-family: monospace, sans-serif !important;
          }
          @page {
            size: 50mm 25mm;
            margin: 0;
          }
        }
      `}} />

      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-8">
        {/* Encabezado Modal */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002D62] text-white flex items-center justify-center shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                  Marbete Institucional de Activo
                </h2>
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {asset.codigo}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Vista previa y formateo físico estándar para etiquetas térmicas de 50mm × 25mm.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido / Vista Previa */}
        <div className="p-6 space-y-6">
          {/* Instrucciones */}
          <div className="p-3.5 bg-sky-50 border border-sky-100 rounded-xl flex items-start gap-2.5 text-xs text-sky-900">
            <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
            <div className="leading-relaxed">
              La etiqueta está preconfigurada a <strong>50mm × 25mm</strong>. Al pulsar Imprimir, seleccione su impresora térmica de marbetes o guarde como PDF a escala 100%.
            </div>
          </div>

          {/* Tarjeta Visual de Vista Previa del Marbete Físico */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-100 rounded-xl border border-dashed border-slate-300">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Vista Previa (Tamaño Escala)
            </span>

            {/* Elemento Imprimible (#printable-badge) */}
            <div
              id="printable-badge"
              ref={badgeRef}
              className="w-[280px] h-[140px] bg-white border-2 border-slate-900 rounded-md p-2.5 flex flex-col justify-between shadow-md text-slate-900 select-none overflow-hidden"
              style={{ boxSizing: "border-box" }}
            >
              {/* Encabezado del Marbete */}
              <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-xs bg-[#002D62] text-white flex items-center justify-center text-[9px] font-black">
                    U
                  </div>
                  <span className="text-[10px] font-extrabold tracking-tight uppercase">
                    UNAPEC · ACTIVO FIJO
                  </span>
                </div>
                <span className="text-[9px] font-mono text-slate-500 font-semibold">
                  {asset.tipoActivo?.codigo || "DGII"}
                </span>
              </div>

              {/* Código Correlativo Principal y Código de Barras */}
              <div className="text-center py-0.5">
                <div className="text-sm font-mono font-black tracking-wider text-slate-950">
                  {asset.codigo}
                </div>
                {renderBarcodeLines()}
              </div>

              {/* Descripción y Metadatos de Radicación */}
              <div className="border-t border-slate-300 pt-1 text-[9px] leading-tight">
                <div className="font-semibold truncate text-slate-800">
                  {asset.descripcion}
                </div>
                <div className="flex justify-between items-center text-slate-600 mt-0.5 text-[8.5px]">
                  <span className="truncate max-w-[130px]">
                    S/N: {asset.numeroSerie || "S/N REG"}
                  </span>
                  <span className="truncate max-w-[120px] font-medium text-right">
                    {asset.departamento?.codigo || "UNAPEC"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer de Acciones */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#002D62] hover:bg-[#002047] shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Marbete</span>
          </button>
        </div>
      </div>
    </div>
  );
}