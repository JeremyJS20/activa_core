import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";
import { validarCedulaJCE } from "../lib/validators/identity";
import { seedActivosFijos } from "./seed-activos";

const prisma = new PrismaClient();

// Generador determinista de cédula dominicana válida (Módulo 10 JCE)
function generarCedulaDominicana(serie: string, correlativo: number): string {
  const primeros10 = `${serie}${correlativo.toString().padStart(7, "0")}`;
  const pesos = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    const d = parseInt(primeros10[i], 10);
    let p = d * pesos[i];
    if (p >= 10) {
      p = Math.floor(p / 10) + (p % 10);
    }
    suma += p;
  }
  const verificador = (10 - (suma % 10)) % 10;
  const cedula = `${primeros10}${verificador}`;
  if (!validarCedulaJCE(cedula)) {
    throw new Error(`Cédula generada inválida: ${cedula}`);
  }
  return cedula;
}

function limpiarTextoParaEmail(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  console.log("=== [1/4] Inicializando Seeding de Seguridad y RBAC ===");

  const rolesData = [
    {
      codigo: "ADMIN",
      nombre: "Administrador General",
      descripcion: "Acceso total y configuracion de gobernanza, seguridad, activos y contabilidad",
      esSistema: true,
      estado: "ACTIVO",
    },
    {
      codigo: "OPERADOR",
      nombre: "Operador de Activos Fijos",
      descripcion: "Gestion operativa de activos, catalogos, transferencias y corrida de depreciacion",
      esSistema: true,
      estado: "ACTIVO",
    },
    {
      codigo: "AUDITOR",
      nombre: "Auditor de Cumplimiento",
      descripcion: "Consulta de registros, reportes ejecutivos, bitacora de auditoria y conciliacion DGII",
      esSistema: true,
      estado: "ACTIVO",
    },
  ];

  const rolesMap = new Map<string, string>();
  for (const r of rolesData) {
    const rol = await prisma.rol.upsert({
      where: { codigo: r.codigo },
      update: {
        nombre: r.nombre,
        descripcion: r.descripcion,
        esSistema: r.esSistema,
        estado: r.estado,
      },
      create: r,
    });
    rolesMap.set(rol.codigo, rol.id);
  }
  console.log(`Roles sincronizados: ${rolesData.length}`);

  const permisosData = [
    { codigo: "USER_ADMIN", modulo: "SEGURIDAD", descripcion: "Administracion de usuarios, roles y control de acceso RBAC" },
    { codigo: "AUDIT_LOG_READ", modulo: "SEGURIDAD", descripcion: "Consulta de traza de auditoria institucional" },
    { codigo: "CAT_READ", modulo: "CATALOGOS", descripcion: "Consulta de catalogos base" },
    { codigo: "CAT_WRITE", modulo: "CATALOGOS", descripcion: "Creacion y edicion de catalogos base" },
    { codigo: "ACT_READ", modulo: "ACTIVOS", descripcion: "Consulta de activos fijos y fichas tecnicas" },
    { codigo: "ACT_CREATE", modulo: "ACTIVOS", descripcion: "Registro de altas de activos fijos" },
    { codigo: "ACT_UPDATE", modulo: "ACTIVOS", descripcion: "Modificacion de datos de activos fijos" },
    { codigo: "ACT_TRANSFER", modulo: "ACTIVOS", descripcion: "Asignacion y transferencia de custodios" },
    { codigo: "ACT_DISPOSE", modulo: "ACTIVOS", descripcion: "Procesamiento de bajas de activos" },
    { codigo: "DEP_CALCULATE", modulo: "DEPRECIACION", descripcion: "Calculo y simulacion de depreciacion" },
    { codigo: "DEP_APPROVE", modulo: "DEPRECIACION", descripcion: "Aprobacion y cierre de depreciacion" },
    { codigo: "DEP_REVERT", modulo: "DEPRECIACION", descripcion: "Reversion de depreciacion" },
    { codigo: "REP_READ", modulo: "REPORTES", descripcion: "Generacion de consultas multicriterio" },
    { codigo: "REP_EXPORT", modulo: "REPORTES", descripcion: "Exportacion de reportes PDF y Excel" },
    { codigo: "ACC_POST_SEND", modulo: "CONTABILIDAD", descripcion: "Envio de asientos contables a WS Contabilidad" },
    { codigo: "ACC_LOG_READ", modulo: "CONTABILIDAD", descripcion: "Consulta de bitacora de integracion contable" },
  ];

  const permisosMap = new Map<string, string>();
  for (const p of permisosData) {
    const permiso = await prisma.permiso.upsert({
      where: { codigo: p.codigo },
      update: { modulo: p.modulo, descripcion: p.descripcion },
      create: p,
    });
    permisosMap.set(permiso.codigo, permiso.id);
  }
  console.log(`Permisos sincronizados: ${permisosData.length}`);

  const rolePermissionsMapping: Record<string, string[]> = {
    ADMIN: permisosData.map((p) => p.codigo),
    OPERADOR: [
      "CAT_READ",
      "CAT_WRITE",
      "ACT_READ",
      "ACT_CREATE",
      "ACT_UPDATE",
      "ACT_TRANSFER",
      "DEP_CALCULATE",
      "REP_READ",
      "REP_EXPORT",
      "ACC_POST_SEND",
    ],
    AUDITOR: [
      "CAT_READ",
      "ACT_READ",
      "REP_READ",
      "REP_EXPORT",
      "ACC_LOG_READ",
      "AUDIT_LOG_READ",
    ],
  };

  for (const [roleCode, permCodes] of Object.entries(rolePermissionsMapping)) {
    const rolId = rolesMap.get(roleCode);
    if (!rolId) continue;

    for (const permCode of permCodes) {
      const permisoId = permisosMap.get(permCode);
      if (!permisoId) continue;

      await prisma.rolPermiso.upsert({
        where: {
          rolId_permisoId: { rolId, permisoId }
        },
        update: {},
        create: { rolId, permisoId },
      });
    }
  }
  console.log("Matriz RBAC configurada exitosamente");

  const adminEmail = "admin@unapec.edu.do";
  const adminPasswordHash = await bcrypt.hash("Admin2026!", 10);
  const adminRoleId = rolesMap.get("ADMIN")!;

  const adminUser = await prisma.usuario.upsert({
    where: { correo: adminEmail },
    update: {
      nombre: "Administrador General ActivaCore",
      passwordHash: adminPasswordHash,
      rolId: adminRoleId,
      estado: "ACTIVO",
    },
    create: {
      nombre: "Administrador General ActivaCore",
      correo: adminEmail,
      passwordHash: adminPasswordHash,
      rolId: adminRoleId,
      estado: "ACTIVO",
    },
  });
  console.log(`Usuario administrador verificado: ${adminUser.correo}`);

  console.log("\n=== [2/4] Sembrando Departamentos Universitarios (10) ===");
  const departamentosData = [
    { codigo: "DEP-001", descripcion: "Dirección de Tecnología de la Información" },
    { codigo: "DEP-002", descripcion: "Decanato de Ingeniería e Informática" },
    { codigo: "DEP-003", descripcion: "Departamento de Contabilidad y Finanzas" },
    { codigo: "DEP-004", descripcion: "Dirección de Recursos Humanos" },
    { codigo: "DEP-005", descripcion: "Departamento de Compras y Suministros" },
    { codigo: "DEP-006", descripcion: "Departamento de Mantenimiento y Planta Física" },
    { codigo: "DEP-007", descripcion: "Dirección de Registro y Admisiones" },
    { codigo: "DEP-008", descripcion: "Rectoría y Secretaría General" },
    { codigo: "DEP-009", descripcion: "Biblioteca Central UNAPEC" },
    { codigo: "DEP-010", descripcion: "Decanato de Ciencias Económicas y Empresariales" },
  ];

  const deptosMap = new Map<string, string>();
  for (const d of departamentosData) {
    const depto = await prisma.departamento.upsert({
      where: { codigo: d.codigo },
      update: { descripcion: d.descripcion, estado: "ACTIVO" },
      create: {
        codigo: d.codigo,
        descripcion: d.descripcion,
        estado: "ACTIVO",
      },
    });
    deptosMap.set(depto.codigo, depto.id);
  }
  console.log(`Departamentos registrados: ${departamentosData.length}`);

  console.log("\n=== [3/4] Sembrando Tipos de Activos DGII y Línea Recta (4) ===");
  const tiposActivosData = [
    {
      codigo: "TPA-001",
      descripcion: "Edificaciones y Estructuras Universitarias (Cat. 1)",
      cuentaContableCompra: "1-01-04-0010",
      cuentaContableDepreciacion: "1-01-04-0011",
      metodoDepreciacion: "DGII_CAT1",
      porcentajeDepreciacionAnual: 5.00,
      vidaUtilMeses: 240,
      estado: "ACTIVO",
    },
    {
      codigo: "TPA-002",
      descripcion: "Equipos de Cómputo, Servidores y Laptops (Cat. 2)",
      cuentaContableCompra: "1-01-04-0020",
      cuentaContableDepreciacion: "1-01-04-0021",
      metodoDepreciacion: "DGII_CAT2",
      porcentajeDepreciacionAnual: 25.00,
      vidaUtilMeses: 48,
      estado: "ACTIVO",
    },
    {
      codigo: "TPA-003",
      descripcion: "Mobiliario y Equipos de Oficina (Cat. 3)",
      cuentaContableCompra: "1-01-04-0030",
      cuentaContableDepreciacion: "1-01-04-0031",
      metodoDepreciacion: "DGII_CAT3",
      porcentajeDepreciacionAnual: 15.00,
      vidaUtilMeses: 80,
      estado: "ACTIVO",
    },
    {
      codigo: "TPA-004",
      descripcion: "Equipos de Laboratorio y Maquinaria Especializada",
      cuentaContableCompra: "1-01-04-0040",
      cuentaContableDepreciacion: "1-01-04-0041",
      metodoDepreciacion: "LINEA_RECTA",
      porcentajeDepreciacionAnual: 10.00,
      vidaUtilMeses: 120,
      estado: "ACTIVO",
    },
  ];

  for (const t of tiposActivosData) {
    await prisma.tipoActivo.upsert({
      where: { codigo: t.codigo },
      update: {
        descripcion: t.descripcion,
        cuentaContableCompra: t.cuentaContableCompra,
        cuentaContableDepreciacion: t.cuentaContableDepreciacion,
        metodoDepreciacion: t.metodoDepreciacion,
        porcentajeDepreciacionAnual: t.porcentajeDepreciacionAnual,
        vidaUtilMeses: t.vidaUtilMeses,
        estado: t.estado,
      },
      create: {
        codigo: t.codigo,
        descripcion: t.descripcion,
        cuentaContableCompra: t.cuentaContableCompra,
        cuentaContableDepreciacion: t.cuentaContableDepreciacion,
        metodoDepreciacion: t.metodoDepreciacion,
        porcentajeDepreciacionAnual: t.porcentajeDepreciacionAnual,
        vidaUtilMeses: t.vidaUtilMeses,
        estado: t.estado,
      },
    });
  }
  console.log(`Tipos de activos registrados: ${tiposActivosData.length}`);

  console.log("\n=== [4/4] Sembrando Empleados Custodios Deterministas con Faker (25) ===");
  faker.seed(42);

  const cargosPorEmpleado: string[] = [
    "Director de Tecnologías de la Información",
    "Decano de Ingeniería e Informática",
    "Director Financiero y Contralor",
    "Directora de Gestión Humana",
    "Encargado de Compras y Suministros",
    "Encargado de Mantenimiento y Planta Física",
    "Directora de Registro y Admisiones",
    "Secretario General de Rectoría",
    "Coordinador General de Biblioteca",
    "Decano de Ciencias Económicas",
    "Administrador de Infraestructura Cloud",
    "Especialista de Ciberseguridad",
    "Coordinador de Laboratorios de Cómputo",
    "Contador Senior de Activos Fijos",
    "Analista de Conciliaciones Bancarias",
    "Especialista de Compensación y Beneficios",
    "Coordinadora de Capacitación Docente",
    "Supervisor de Almacén Central",
    "Técnico Especialista en Climatización",
    "Técnico Electricista Industrial",
    "Analista de Admisiones y Matrícula",
    "Asistente Ejecutiva de Rectoría",
    "Encargada de Hemeroteca y Archivo",
    "Docente Investigador Titular",
    "Analista de Inteligencia Institucional",
  ];

  const deptoCodigos = departamentosData.map((d) => d.codigo);
  const empleadosCreados: { id: string; codigo: string; nombre: string; deptoCodigo: string }[] = [];

  for (let i = 0; i < 25; i++) {
    const num = i + 1;
    const codigo = `EMP-${num.toString().padStart(4, "0")}`;
    const deptoCodigo = i < 10 ? deptoCodigos[i] : deptoCodigos[i % 10];
    const departamentoId = deptosMap.get(deptoCodigo)!;

    const nombre = faker.person.firstName();
    const apellido = faker.person.lastName();
    const cedula = generarCedulaDominicana("402", 1000000 + i * 37 + 13);
    const cargo = cargosPorEmpleado[i];
    const emailPrefix = `${limpiarTextoParaEmail(nombre)}.${limpiarTextoParaEmail(apellido)}`;
    const correo = `${emailPrefix}${i > 15 ? i : ""}@unapec.edu.do`;
    const telefono = `(809) ${555 + (i % 5)}-${(1000 + i * 111).toString().slice(0, 4)}`;

    const fechaIngreso = faker.date.between({
      from: new Date("2018-01-15T00:00:00Z"),
      to: new Date("2025-06-30T00:00:00Z"),
    });

    const empleado = await prisma.empleado.upsert({
      where: { codigo },
      update: {
        nombre,
        apellido,
        tipoPersona: "FISICA",
        cedula,
        departamentoId,
        cargo,
        correo,
        telefono,
        fechaIngreso,
        estado: "ACTIVO",
      },
      create: {
        codigo,
        nombre,
        apellido,
        tipoPersona: "FISICA",
        cedula,
        departamentoId,
        cargo,
        correo,
        telefono,
        fechaIngreso,
        estado: "ACTIVO",
      },
    });

    empleadosCreados.push({
      id: empleado.id,
      codigo: empleado.codigo,
      nombre: `${empleado.nombre} ${empleado.apellido}`,
      deptoCodigo,
    });
  }
  console.log(`Empleados registrados y validados con Cédula JCE: ${empleadosCreados.length}`);

  console.log("\n=== Asignando Responsables a Departamentos ===");
  for (let i = 0; i < 10; i++) {
    const deptoCodigo = deptoCodigos[i];
    const responsable = empleadosCreados[i];
    await prisma.departamento.update({
      where: { codigo: deptoCodigo },
      data: { responsableId: responsable.id },
    });
    console.log(`  - ${deptoCodigo} -> Responsable: ${responsable.nombre} (${responsable.codigo})`);
  }

  console.log("\n===================================================");
  await seedActivosFijos(prisma, adminUser.id, empleadosCreados, deptosMap);

  console.log("\n===================================================");
  console.log("✔ Seed de Catálogos, Empleados y Activos Fijos Completado con Éxito");
  console.log("===================================================");
}

main()
  .catch((e) => {
    console.error("Error fatal durante el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
