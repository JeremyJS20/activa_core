"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Calendar,
  CreditCard,
} from "lucide-react";
import {
  EmployeeCreateSchema,
  EmployeeUpdateSchema,
} from "@/lib/schemas/employee.schema";
import {
  validarCedulaJCE,
  validarRncDGII,
  normalizarDocumento,
} from "@/lib/validators/identity";

export interface DepartmentOption {
  id: string;
  codigo: string;
  descripcion: string;
}

export interface EmployeeRow {
  id: string;
  codigo: string;
  nombre: string;
  apellido: string;
  nombreCompleto?: string;
  cedula: string;
  tipoPersona: "FISICA" | "JURIDICA";
  departamentoId: string;
  departamento?: {
    id: string;
    codigo: string;
    descripcion: string;
  } | null;
  cargo: string;
  correo: string | null;
  telefono: string | null;
  fechaIngreso: string;
  estado: "ACTIVO" | "INACTIVO";
  departamentosResponsable?: {
    id: string;
    codigo: string;
    descripcion: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

interface EmployeeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeToEdit?: EmployeeRow | null;
}

export function formatCedulaInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  let res = digits.slice(0, 3);
  if (digits.length > 3) res += "-" + digits.slice(3, 10);
  if (digits.length > 10) res += "-" + digits.slice(10, 11);
  return res;
}

export function formatRncInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (!digits) return "";
  let res = digits.slice(0, 1);
  if (digits.length > 1) res += "-" + digits.slice(1, 3);
  if (digits.length > 3) res += "-" + digits.slice(3, 8);
  if (digits.length > 8) res += "-" + digits.slice(8, 9);
  return res;
}

export function EmployeeDialog({
  isOpen,
  onClose,
  onSaved,
  employeeToEdit,
}: EmployeeDialogProps) {
  const isEditing = Boolean(employeeToEdit);

  // Form State
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [tipoPersona, setTipoPersona] = useState<"FISICA" | "JURIDICA">("FISICA");
  const [cedula, setCedula] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [cargo, setCargo] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [estado, setEstado] = useState<"ACTIVO" | "INACTIVO">("ACTIVO");

  // Operational State
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Fecha maxima permitida: hoy (bloquea fechas futuras)
  const maxDate = new Date().toISOString().split("T")[0];

  // Evaluacion cripto-aritmetica en vivo de cedula dominicana (Modulo 10 JCE)
  const docLimpio = normalizarDocumento(cedula);
  const isCedulaComplete = tipoPersona === "FISICA" ? docLimpio.length === 11 : docLimpio.length === 9;
  const isCedulaValid =
    tipoPersona === "FISICA"
      ? validarCedulaJCE(docLimpio)
      : validarRncDGII(docLimpio);

  useEffect(() => {
    if (!isOpen) return;

    if (employeeToEdit) {
      setCodigo(employeeToEdit.codigo || "");
      setNombre(employeeToEdit.nombre || "");
      setApellido(employeeToEdit.apellido || "");
      setTipoPersona(employeeToEdit.tipoPersona || "FISICA");
      setCedula(
        employeeToEdit.tipoPersona === "JURIDICA"
          ? formatRncInput(employeeToEdit.cedula || "")
          : formatCedulaInput(employeeToEdit.cedula || "")
      );
      setDepartamentoId(employeeToEdit.departamentoId || employeeToEdit.departamento?.id || "");
      setCargo(employeeToEdit.cargo || "");
      setCorreo(employeeToEdit.correo || "");
      setTelefono(employeeToEdit.telefono || "");

      // Extraer YYYY-MM-DD
      const rawDate = employeeToEdit.fechaIngreso
        ? new Date(employeeToEdit.fechaIngreso).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      setFechaIngreso(rawDate);
      setEstado(employeeToEdit.estado || "ACTIVO");
    } else {
      setCodigo("");
      setNombre("");
      setApellido("");
      setTipoPersona("FISICA");
      setCedula("");
      setDepartamentoId("");
      setCargo("");
      setCorreo("");
      setTelefono("");
      setFechaIngreso(new Date().toISOString().split("T")[0]);
      setEstado("ACTIVO");
    }

    setFieldErrors({});
    setServerError(null);

    // Cargar departamentos activos
    let isMounted = true;
    setIsLoadingDepartments(true);

    fetch("/api/departamentos?estado=ACTIVO&limit=100")
      .then(async (res) => {
        if (!res.ok) throw new Error("No fue posible cargar el listado de departamentos.");
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        const mapped: DepartmentOption[] = list.map((d: any) => ({
          id: d.id,
          codigo: d.codigo,
          descripcion: d.descripcion,
        }));

        setDepartments(mapped);
        if (mapped.length > 0 && !employeeToEdit) {
          setDepartamentoId(mapped[0].id);
        }
        setIsLoadingDepartments(false);
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Error al cargar departamentos:", err);
          setIsLoadingDepartments(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, employeeToEdit]);

  if (!isOpen) return null;

  const handleCedulaChange = (raw: string) => {
    const formatted =
      tipoPersona === "JURIDICA" ? formatRncInput(raw) : formatCedulaInput(raw);
    setCedula(formatted);
    if (fieldErrors.cedula) {
      setFieldErrors((prev) => ({ ...prev, cedula: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const payload: {
      codigo?: string;
      nombre: string;
      apellido: string;
      tipoPersona: "FISICA" | "JURIDICA";
      cedula: string;
      departamentoId: string;
      cargo: string;
      correo?: string | null;
      telefono?: string | null;
      fechaIngreso: string;
      estado: "ACTIVO" | "INACTIVO";
    } = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      tipoPersona,
      cedula: normalizarDocumento(cedula),
      departamentoId,
      cargo: cargo.trim(),
      correo: correo.trim() ? correo.trim().toLowerCase() : null,
      telefono: telefono.trim() ? telefono.trim() : null,
      fechaIngreso: new Date(fechaIngreso).toISOString(),
      estado,
    };

    if (codigo.trim()) {
      payload.codigo = codigo.trim().toUpperCase();
    }

    // Validar esquema mediante Zod
    const schema = isEditing ? EmployeeUpdateSchema : EmployeeCreateSchema;
    const validation = schema.safeParse(payload);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const fieldName = (issue.path[0] as string) || "general";
        if (!errors[fieldName]) {
          errors[fieldName] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing
        ? "/api/empleados/" + employeeToEdit!.id
        : "/api/empleados";

      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (responseData.error === "EMPLOYEE_CODE_DUPLICATE") {
          setFieldErrors((prev) => ({
            ...prev,
            codigo: "Ya existe un colaborador registrado con este código institucional.",
          }));
          throw new Error("El código de colaborador ya est? en uso.");
        }
        if (responseData.error === "EMPLOYEE_CEDULA_DUPLICATE") {
          setFieldErrors((prev) => ({
            ...prev,
            cedula: "Ya existe un empleado registrado con esta cédula en la universidad.",
          }));
          throw new Error("El documento de identidad ya se encuentra registrado.");
        }
        if (responseData.error === "CEDULA_INVALID_CHECKSUM") {
          setFieldErrors((prev) => ({
            ...prev,
            cedula: "La cédula no superó el algoritmo Módulo 10 de la JCE.",
          }));
          throw new Error("El número de cédula ingresado es inválido.");
        }
        if (responseData.error === "EMPLOYEE_IS_DEPARTMENT_HEAD") {
          throw new Error(
            "El colaborador figura como custodio/responsable de departamentos activos. Debe reasignar la jefatura antes de inactivarlo."
          );
        }

        throw new Error(
          responseData.message ||
            (isEditing
              ? "Error al actualizar los datos del empleado."
              : "Error al registrar el nuevo empleado.")
        );
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setServerError(err.message || "Ocurri? un error inesperado al procesar el empleado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-8">
        {/* Header Modal */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002D62] text-white flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                {isEditing ? "Modificar Colaborador / Custodio" : "Nuevo Colaborador / Custodio"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEditing
                  ? "Actualice los datos institucionales del custodio de activos fijos."
                  : "Registre un nuevo custodio con validación JCE de identidad dominicana."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Banner de Error del Servidor */}
          {serverError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200/90 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          {/* Grid de Código y Tipo Persona */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Código */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Código Institucional
                {!isEditing && (
                  <span className="text-[11px] font-normal text-slate-400 ml-1">
                    (Opcional)
                  </span>
                )}
              </label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value.toUpperCase());
                  if (fieldErrors.codigo) {
                    setFieldErrors((prev) => ({ ...prev, codigo: "" }));
                  }
                }}
                maxLength={10}
                placeholder={isEditing ? "ej. EMP-0001" : "Auto-generado (EMP-XXXX)"}
                className={
                  "w-full px-3.5 py-2 text-sm font-mono bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                  (fieldErrors.codigo
                    ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                    : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                }
              />
              {fieldErrors.codigo ? (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.codigo}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">
                  Matrícula o código de empleado universitario.
                </p>
              )}
            </div>

            {/* Tipo de Persona */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Naturaleza de Identidad <span className="text-rose-500">*</span>
              </label>
              <select
                value={tipoPersona}
                onChange={(e) => {
                  const val = e.target.value as "FISICA" | "JURIDICA";
                  setTipoPersona(val);
                  setCedula("");
                }}
                className="w-full px-3.5 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003D9B]/20 focus:border-[#003D9B] focus:bg-white transition-all text-slate-800"
              >
                <option value="FISICA">Persona Física (Cédula JCE · 11 dígitos)</option>
                <option value="JURIDICA">Persona Jurídica / Proveedor (RNC DGII · 9 dígitos)</option>
              </select>
            </div>
          </div>

          {/* Nombres y Apellidos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nombre(s) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  if (fieldErrors.nombre) {
                    setFieldErrors((prev) => ({ ...prev, nombre: "" }));
                  }
                }}
                maxLength={100}
                placeholder="ej. Juan Carlos"
                className={
                  "w-full px-3.5 py-2 text-sm bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                  (fieldErrors.nombre
                    ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                    : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                }
              />
              {fieldErrors.nombre && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.nombre}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Apellido(s) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={apellido}
                onChange={(e) => {
                  setApellido(e.target.value);
                  if (fieldErrors.apellido) {
                    setFieldErrors((prev) => ({ ...prev, apellido: "" }));
                  }
                }}
                maxLength={100}
                placeholder="ej. Pérez Gómez"
                className={
                  "w-full px-3.5 py-2 text-sm bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                  (fieldErrors.apellido
                    ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                    : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                }
              />
              {fieldErrors.apellido && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.apellido}
                </p>
              )}
            </div>
          </div>

          {/* Documento de Identidad con Validación Cripto-Aritmética en Vivo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {tipoPersona === "FISICA" ? "Cédula de Identidad JCE" : "RNC de Persona Jurídica"}{" "}
                <span className="text-rose-500">*</span>
              </label>

              {/* Badge de Verificación Cripto-Aritmética en Vivo */}
              {isCedulaComplete ? (
                isCedulaValid ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-in fade-in duration-100">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cédula JCE Válida (Módulo 10)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-in fade-in duration-100">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>Dígito verificador inválido JCE</span>
                  </span>
                )
              ) : (
                <span className="text-[11px] text-slate-400 font-mono">
                  {docLimpio.length} / {tipoPersona === "FISICA" ? 11 : 9} dígitos
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={cedula}
                onChange={(e) => handleCedulaChange(e.target.value)}
                maxLength={tipoPersona === "FISICA" ? 13 : 11}
                placeholder={tipoPersona === "FISICA" ? "402-0000000-0" : "1-01-00000-0"}
                className={
                  "w-full px-3.5 py-2 text-sm font-mono bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                  (isCedulaComplete && !isCedulaValid
                    ? "border-rose-400 focus:ring-rose-500/20 text-rose-900 bg-rose-50/20"
                    : isCedulaComplete && isCedulaValid
                    ? "border-emerald-400 focus:ring-emerald-500/20 text-emerald-900 bg-emerald-50/20"
                    : fieldErrors.cedula
                    ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                    : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                }
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>

            {fieldErrors.cedula ? (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">
                {fieldErrors.cedula}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                Formato automático con verificación de padrón electoral JCE.
              </p>
            )}
          </div>

          {/* Departamento y Cargo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Departamento */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Departamento Asignado <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={departamentoId}
                  onChange={(e) => {
                    setDepartamentoId(e.target.value);
                    if (fieldErrors.departamentoId) {
                      setFieldErrors((prev) => ({ ...prev, departamentoId: "" }));
                    }
                  }}
                  disabled={isLoadingDepartments}
                  className={
                    "w-full px-3.5 py-2 text-sm bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                    (fieldErrors.departamentoId
                      ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                      : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                  }
                >
                  <option value="">-- Seleccionar Departamento --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.codigo} · {d.descripcion}
                    </option>
                  ))}
                </select>
                {isLoadingDepartments && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                )}
              </div>
              {fieldErrors.departamentoId && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.departamentoId}
                </p>
              )}
            </div>

            {/* Cargo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cargo Institucional <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => {
                  setCargo(e.target.value);
                  if (fieldErrors.cargo) {
                    setFieldErrors((prev) => ({ ...prev, cargo: "" }));
                  }
                }}
                maxLength={100}
                placeholder="ej. Director de Carrera, Analista TI"
                className={
                  "w-full px-3.5 py-2 text-sm bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                  (fieldErrors.cargo
                    ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                    : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                }
              />
              {fieldErrors.cargo && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.cargo}
                </p>
              )}
            </div>
          </div>

          {/* Correo y Teléfono */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Correo Institucional
              </label>
              <input
                type="email"
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value);
                  if (fieldErrors.correo) {
                    setFieldErrors((prev) => ({ ...prev, correo: "" }));
                  }
                }}
                maxLength={150}
                placeholder="ej. j.perez@unapec.edu.do"
                className={
                  "w-full px-3.5 py-2 text-sm bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                  (fieldErrors.correo
                    ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                    : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                }
              />
              {fieldErrors.correo ? (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.correo}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">
                  Dominio institucional @unapec.edu.do recomendado.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Teléfono o Extensión
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                maxLength={20}
                placeholder="ej. (809) 686-0021 Ext. 204"
                className="w-full px-3.5 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003D9B]/20 focus:border-[#003D9B] focus:bg-white transition-all text-slate-800"
              />
            </div>
          </div>

          {/* Fecha de Ingreso y Estado Operativo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Fecha de Ingreso / Contratación <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  max={maxDate}
                  value={fechaIngreso}
                  onChange={(e) => {
                    setFechaIngreso(e.target.value);
                    if (fieldErrors.fechaIngreso) {
                      setFieldErrors((prev) => ({ ...prev, fechaIngreso: "" }));
                    }
                  }}
                  className={
                    "w-full px-3.5 py-2 text-sm font-mono bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                    (fieldErrors.fechaIngreso
                      ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                      : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                  }
                />
              </div>
              {fieldErrors.fechaIngreso ? (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.fechaIngreso}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">
                  No se admiten fechas futuras de contratación.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Estado Operativo <span className="text-rose-500">*</span>
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as "ACTIVO" | "INACTIVO")}
                className="w-full px-3.5 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003D9B]/20 focus:border-[#003D9B] focus:bg-white transition-all text-slate-800"
              >
                <option value="ACTIVO">Activo (Habilitado para custodia)</option>
                <option value="INACTIVO">Inactivo (Desvinculado / Licencia)</option>
              </select>
            </div>
          </div>

          {/* Footer de Acciones */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#002D62] hover:bg-[#003D9B] active:bg-[#002047] rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : isEditing ? (
                <span>Guardar Cambios</span>
              ) : (
                <span>Registrar Empleado</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
