"use client";

import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { AsientoRow, formatCurrency, formatFecha } from "./types";

interface AsientoPreviewProps {
  asiento: AsientoRow | null;
  compact?: boolean;
}

function EstadoAsientoPill({ estado }: { estado: string }) {
  if (estado === "ENVIADO") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Enviado
      </span>
    );
  }
  if (estado === "ERROR") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      Pendiente de envío
    </span>
  );
}

export function AsientoPreview({ asiento, compact = false }: AsientoPreviewProps) {
  if (!asiento) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
        <FileText className="w-6 h-6 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-500">
          Este período aún no tiene asiento contable generado.
        </p>
      </div>
    );
  }

  const totalDebito = Number(asiento.totalDebito);
  const totalCredito = Number(asiento.totalCredito);
  const cuadrado = Math.abs(totalDebito - totalCredito) < 0.005;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-[#003D9B] bg-[#003D9B]/10 px-2.5 py-1 rounded-md border border-[#003D9B]/20">
            {asiento.numeroAsiento}
          </span>
          <EstadoAsientoPill estado={asiento.estado} />
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          Fecha contable: {formatFecha(asiento.fechaContable)}
        </span>
      </div>

      <div className="border border-slate-200/90 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
            <tr>
              <th scope="col" className="py-2.5 px-3">Cuenta</th>
              {!compact && (
                <th scope="col" className="py-2.5 px-3">Descripción</th>
              )}
              <th scope="col" className="py-2.5 px-3 text-center">Movimiento</th>
              <th scope="col" className="py-2.5 px-3 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {asiento.lineas.map((linea) => (
              <tr key={linea.id} className="hover:bg-[#F2F3FF] transition-colors">
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <span className="font-mono text-xs text-slate-800">
                    {linea.cuentaContable}
                  </span>
                </td>
                {!compact && (
                  <td className="py-2.5 px-3 text-slate-600">{linea.descripcion}</td>
                )}
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      linea.tipoMovimiento === "DEBITO"
                        ? "bg-slate-100 text-slate-700 border-slate-200"
                        : "bg-[#EBF3FC] text-[#003D9B] border-[#003D9B]/20"
                    }`}
                  >
                    {linea.tipoMovimiento === "DEBITO" ? "Débito" : "Crédito"}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <span className="font-mono text-xs font-semibold text-slate-900">
                    {formatCurrency(linea.monto)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50/70 border-t border-slate-200/80">
            <tr>
              <td colSpan={compact ? 2 : 3} className="py-2.5 px-3 text-right text-[11px] font-semibold text-slate-500 font-mono">
                Total débito
              </td>
              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                <span className="font-mono text-xs font-bold text-slate-900">
                  {formatCurrency(asiento.totalDebito)}
                </span>
              </td>
            </tr>
            <tr>
              <td colSpan={compact ? 2 : 3} className="py-2 px-3 text-right text-[11px] font-semibold text-slate-500 font-mono">
                Total crédito
              </td>
              <td className="py-2 px-3 text-right whitespace-nowrap">
                <span className="font-mono text-xs font-bold text-slate-900">
                  {formatCurrency(asiento.totalCredito)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div
        className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border ${
          cuadrado
            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
            : "bg-rose-50 text-rose-800 border-rose-200"
        }`}
      >
        {cuadrado ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
        )}
        <span>
          {cuadrado
            ? "Asiento cuadrado: débitos y créditos coinciden."
            : "Asiento descuadrado: los totales no coinciden."}
        </span>
      </div>
    </div>
  );
}
