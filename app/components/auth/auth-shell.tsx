import { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F2F3FF]">
      {/* Panel Izquierdo: Identidad Institucional */}
      <div className="w-full lg:w-[50%] xl:w-[52%] bg-[#0F172A] p-8 sm:p-12 lg:p-16 xl:p-20 flex flex-col justify-between relative overflow-hidden">
        {/* Glow Tonal de Fondo */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#003D9B]/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#0052CC]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Cabecera / Identidad */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003D9B] text-white flex items-center justify-center font-display font-black text-base tracking-wider shadow-sm">
            AC
          </div>
          <div>
            <span className="font-display font-extrabold text-xl text-white tracking-tight block leading-none">
              ActivaCore
            </span>
            <span className="text-[10px] font-mono text-slate-400 tracking-wider uppercase block leading-none mt-1">
              UNAPEC · Activos Fijos
            </span>
          </div>
        </div>

        {/* Narrativa Central (Limpia, sin badges decorativos de IA) */}
        <div className="relative z-10 my-12 lg:my-0 max-w-lg space-y-4">
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-[1.15]">
            {title}
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-sans">
            {subtitle}
          </p>
        </div>

        {/* Pie Institucional */}
        <div className="text-xs text-slate-400 font-mono space-y-1">
          <p className="text-slate-300 font-medium">Universidad APEC (UNAPEC)</p>
          <p className="text-slate-500">Dirección de Tecnología & Finanzas · Santo Domingo, D.N.</p>
        </div>
      </div>

      {/* Panel Derecho: Contenedor de Formulario */}
      <div className="w-full lg:w-[50%] xl:w-[48%] flex items-center justify-center p-6 sm:p-12 lg:p-16">
        {children}
      </div>
    </div>
  );
}
