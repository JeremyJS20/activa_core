"use client";

import { useMemo, useState } from "react";
import { Check, Code2, Copy } from "lucide-react";

interface PayloadViewerProps {
  payload: unknown;
  label?: string;
}

/** Visor de solo lectura del JSON exacto enviado/recibido por el WS. */
export function PayloadViewer({ payload, label = "Payload" }: PayloadViewerProps) {
  const [copiado, setCopiado] = useState(false);
  const [errorCopia, setErrorCopia] = useState(false);

  const json = useMemo(() => {
    try {
      return JSON.stringify(payload ?? null, null, 2);
    } catch {
      return "No fue posible serializar el payload.";
    }
  }, [payload]);

  const copiar = async () => {
    setErrorCopia(false);
    try {
      await navigator.clipboard.writeText(json);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErrorCopia(true);
    }
  };

  return (
    <section
      className="rounded-xl border border-slate-200/90 bg-slate-950 overflow-hidden"
      aria-label={label}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300 font-mono">
          <Code2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>{label}</span>
        </div>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
          aria-label={`Copiar ${label} al portapapeles`}
        >
          {copiado ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              Copiar
            </>
          )}
        </button>
      </div>
      <pre
        className="max-h-80 overflow-auto p-3 text-[11px] leading-relaxed text-slate-200 font-mono whitespace-pre"
        aria-label={`${label} en formato JSON, solo lectura`}
        tabIndex={0}
      >
        {json}
      </pre>
      {errorCopia && (
        <p role="alert" className="px-3 py-1.5 text-[11px] text-rose-300 bg-rose-950/40">
          No fue posible copiar automáticamente. Seleccione el texto y copie manualmente.
        </p>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {copiado ? "Payload copiado al portapapeles." : ""}
      </span>
    </section>
  );
}
