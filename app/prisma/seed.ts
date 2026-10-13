import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed determinista de seguridad y RBAC...");

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
      descripcion: "Consulta de registros, reportes ejecutivos, bitacora de auditoria y conciliacion DGRI",
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
    console.log('Rol verificado: ' + rol.codigo);
  }

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
  console.log('Permisos sincronizados: ' + permisosData.length);

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
          rolId_permisoId: {rolId, permisoId}
        },
        update: {},
        create: {rolId, permisoId},
      });
    }
    console.log('Matriz configurada para rol: ' + roleCode);
  }

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

  console.log('Administrador verificado: ' + adminUser.correo);
  console.log('Seed finalizado con exito.');
}


main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
