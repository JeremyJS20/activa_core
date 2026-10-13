import { ReactNode, Suspense } from "react";
import { TopNavbar } from "./top-navbar";
import { AppSidebar } from "./app-sidebar";

interface ConsoleShellProps {
  children: ReactNode;
}

function NavbarSkeleton() {
  return (
    <header className="h-16 w-full bg-white border-b border-slate-200/80 sticky top-0 z-20 px-6 sm:px-8 flex items-center justify-between shadow-xs">
      <div className="w-48 h-4 rounded-md bg-slate-100 animate-pulse" />
      <div className="w-28 h-8 rounded-xl bg-slate-100 animate-pulse" />
    </header>
  );
}

export function ConsoleShell({ children }: ConsoleShellProps) {
  return (
    <div className="min-h-screen flex bg-[#F2F3FF] text-[#1B2A4A]">
      {/* Sidebar de Navegación */}
      <AppSidebar />

      {/* Área de Trabajo Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <Suspense fallback={<NavbarSkeleton />}>
          <TopNavbar />
        </Suspense>
        <main className="flex-1">
          <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Cargando contenido institucional...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
