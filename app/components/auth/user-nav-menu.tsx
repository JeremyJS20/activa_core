"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  ChevronDown,
  User,
  Shield,
  LogOut,
} from "lucide-react";

interface UserNavMenuProps {
  user: {
    id?: string;
    nombre: string;
    correo: string;
    rol?: {
      codigo: string;
      nombre: string;
    };
  };
}

export function UserNavMenu({ user }: UserNavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user.nombre
    ? user.nombre
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AC";

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const roleName = user.rol?.nombre || "Colaborador";

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button (Limpio, sin role pills ni corchetes) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-[#0052CC]/20"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-display font-bold text-xs tracking-wider">
          {initials}
        </div>

        <div className="hidden sm:flex flex-col text-left">
          <span className="font-display font-semibold text-xs text-[#1B2A4A] leading-tight">
            {user.nombre}
          </span>
          <span className="text-[10px] text-slate-400 font-mono leading-tight">
            {roleName}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Header Info (Sin pills de sesión activa) */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="font-display font-bold text-xs text-[#1B2A4A] truncate">
              {user.nombre}
            </p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {user.correo}
            </p>
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              {roleName}
            </p>
          </div>

          {/* Links */}
          <div className="p-1.5 space-y-0.5">
            <Link
              href="/perfil"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 hover:text-[#003D9B] hover:bg-slate-50 transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>Mi Perfil & Contraseña</span>
            </Link>

            <Link
              href="/admin/usuarios"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 hover:text-[#003D9B] hover:bg-slate-50 transition-colors"
            >
              <Shield className="w-4 h-4 text-slate-400" />
              <span>Gestión de Usuarios & RBAC</span>
            </Link>
          </div>

          {/* Sign Out */}
          <div className="p-1.5 border-t border-slate-100 mt-1">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
