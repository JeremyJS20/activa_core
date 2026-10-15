import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock de autenticación NextAuth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock de Prisma Client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    empleado: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    departamento: {
      findUnique: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET as getEmpleados, POST as createEmpleado } from "@/app/api/empleados/route";
import {
  GET as getEmpleadoById,
  PUT as updateEmpleado,
  DELETE as deleteEmpleado,
} from "@/app/api/empleados/[id]/route";

describe("API Route Handlers - Empleados (/api/empleados)", () => {
  const adminUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000001",
      nombre: "Admin General",
      correo: "admin@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000001", codigo: "ADMIN", nombre: "Administrador General" },
      permisos: ["USER_ADMIN", "CAT_READ", "CAT_WRITE"],
    },
  };

  const operadorUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000002",
      nombre: "Operador Activos",
      correo: "operador@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000002", codigo: "OPERADOR", nombre: "Operador de Activos" },
      permisos: ["CAT_READ", "CAT_WRITE"],
    },
  };

  const readOnlyUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000003",
      nombre: "Auditor",
      correo: "auditor@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000003", codigo: "AUDITOR", nombre: "Auditor" },
      permisos: ["CAT_READ"],
    },
  };

  const DEPT_UUID = "a0000000-0000-4000-a000-000000000001";
  const EMP_UUID = "b0000000-0000-4000-a000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/empleados", () => {
    it("debe retornar HTTP 401 si no hay sesión autenticada", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost:3000/api/empleados");
      const res = await getEmpleados(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("debe retornar HTTP 403 si el usuario carece de permiso CAT_READ", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: "sin-perm", permisos: [] },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/empleados");
      const res = await getEmpleados(req);

      expect(res.status).toBe(403);
    });

    it("debe retornar HTTP 200 con la lista paginada de colaboradores", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);

      const mockEmpleados = [
        {
          id: EMP_UUID,
          codigo: "EMP-0001",
          nombre: "Nikita",
          apellido: "Crist",
          tipoPersona: "FISICA",
          cedula: "40200000004",
          departamentoId: DEPT_UUID,
          cargo: "Director TI",
          correo: "nikita.crist@unapec.edu.do",
          telefono: "(809) 555-1000",
          fechaIngreso: new Date("2020-03-15"),
          estado: "ACTIVO",
          createdAt: new Date(),
          updatedAt: new Date(),
          departamento: { id: DEPT_UUID, codigo: "DEP-001", descripcion: "Tecnología" },
          departamentosResponsable: [{ id: DEPT_UUID, codigo: "DEP-001", descripcion: "Tecnología" }],
        },
      ];

      vi.mocked(prisma.empleado.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.empleado.findMany).mockResolvedValueOnce(mockEmpleados as any);

      const req = new NextRequest("http://localhost:3000/api/empleados?page=1&limit=10");
      const res = await getEmpleados(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].codigo).toBe("EMP-0001");
      expect(body.data[0].esResponsableDe).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });
  });

  describe("POST /api/empleados", () => {
    it("debe retornar HTTP 422 con CEDULA_INVALID_CHECKSUM si la cédula falla el algoritmo Módulo 10", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);

      const req = new NextRequest("http://localhost:3000/api/empleados", {
        method: "POST",
        body: JSON.stringify({
          nombre: "Juan",
          apellido: "Pérez",
          tipoPersona: "FISICA",
          cedula: "402-0000000-5", // Inválido (el correcto es 4)
          departamentoId: DEPT_UUID,
          cargo: "Analista",
          fechaIngreso: "2024-01-15",
        }),
      });
      const res = await createEmpleado(req);

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toBe("CEDULA_INVALID_CHECKSUM");
    });

    it("debe retornar HTTP 404 si el departamento asignado no existe", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce(null); // Departamento no existe

      const nonExistentDept = "a0000000-0000-4000-a000-000000000099";
      const req = new NextRequest("http://localhost:3000/api/empleados", {
        method: "POST",
        body: JSON.stringify({
          nombre: "Carlos",
          apellido: "Gómez",
          tipoPersona: "FISICA",
          cedula: "402-0000000-4", // Válida
          departamentoId: nonExistentDept,
          cargo: "Coordinador",
          fechaIngreso: "2024-02-01",
        }),
      });
      const res = await createEmpleado(req);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("DEPARTMENT_NOT_FOUND");
    });

    it("debe retornar HTTP 409 si la cédula ya se encuentra registrada", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce({
        id: DEPT_UUID,
        codigo: "DEP-001",
      } as any);
      vi.mocked(prisma.empleado.findUnique).mockResolvedValueOnce({
        id: EMP_UUID,
        cedula: "40200000004",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/empleados", {
        method: "POST",
        body: JSON.stringify({
          nombre: "Carlos",
          apellido: "Gómez",
          tipoPersona: "FISICA",
          cedula: "402-0000000-4", // Válida pero ya registrada
          departamentoId: DEPT_UUID,
          cargo: "Coordinador",
          fechaIngreso: "2024-02-01",
        }),
      });
      const res = await createEmpleado(req);

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("CEDULA_DUPLICATE");
    });

    it("debe autogenerar código EMP-0026 y registrar exitosamente con HTTP 201 Created", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce({
        id: DEPT_UUID,
        codigo: "DEP-001",
      } as any);
      vi.mocked(prisma.empleado.findUnique).mockResolvedValueOnce(null); // No duplicado por cédula
      vi.mocked(prisma.empleado.findMany).mockResolvedValueOnce([
        { codigo: "EMP-0001" },
        { codigo: "EMP-0025" },
      ] as any);

      const createdEmp = {
        id: "b0000000-0000-4000-a000-000000000026",
        codigo: "EMP-0026",
        nombre: "María",
        apellido: "Fernández",
        tipoPersona: "FISICA",
        cedula: "40200000004",
        departamentoId: DEPT_UUID,
        cargo: "Especialista TI",
        correo: "mfernandez@unapec.edu.do",
        telefono: "(809) 555-4321",
        fechaIngreso: new Date("2024-01-10"),
        estado: "ACTIVO",
        createdAt: new Date(),
        updatedAt: new Date(),
        departamento: { id: DEPT_UUID, codigo: "DEP-001", descripcion: "Tecnología" },
      };
      vi.mocked(prisma.empleado.create).mockResolvedValueOnce(createdEmp as any);

      const req = new NextRequest("http://localhost:3000/api/empleados", {
        method: "POST",
        body: JSON.stringify({
          nombre: "María",
          apellido: "Fernández",
          tipoPersona: "FISICA",
          cedula: "402-0000000-4",
          departamentoId: DEPT_UUID,
          cargo: "Especialista TI",
          correo: "mfernandez@unapec.edu.do",
          telefono: "(809) 555-4321",
          fechaIngreso: "2024-01-10",
        }),
      });
      const res = await createEmpleado(req);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.codigo).toBe("EMP-0026");
      expect(body.cedula).toBe("40200000004");
      expect(prisma.empleado.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            codigo: "EMP-0026",
            cedula: "40200000004",
          }),
        })
      );
    });
  });

  describe("GET /api/empleados/[id]", () => {
    it("debe retornar HTTP 404 si el colaborador no existe", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.empleado.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest(`http://localhost:3000/api/empleados/${EMP_UUID}`);
      const res = await getEmpleadoById(req, {
        params: Promise.resolve({ id: EMP_UUID }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("EMPLOYEE_NOT_FOUND");
    });
  });

  describe("PUT /api/empleados/[id]", () => {
    it("debe incluir advertencia EMPLOYEE_IS_DEPARTMENT_HEAD al inactivar a un responsable departamental", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.empleado.findUnique).mockResolvedValueOnce({
        id: EMP_UUID,
        codigo: "EMP-0001",
        nombre: "Nikita",
        estado: "ACTIVO",
        cedula: "40200000004",
      } as any);

      // Simular que es director de DEP-001
      vi.mocked(prisma.departamento.findMany).mockResolvedValueOnce([
        { id: DEPT_UUID, codigo: "DEP-001", descripcion: "Tecnología" },
      ] as any);

      vi.mocked(prisma.empleado.update).mockResolvedValueOnce({
        id: EMP_UUID,
        codigo: "EMP-0001",
        nombre: "Nikita",
        estado: "INACTIVO",
        departamentosResponsable: [{ id: DEPT_UUID, codigo: "DEP-001", descripcion: "Tecnología" }],
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/empleados/${EMP_UUID}`, {
        method: "PUT",
        body: JSON.stringify({
          estado: "INACTIVO",
        }),
      });
      const res = await updateEmpleado(req, {
        params: Promise.resolve({ id: EMP_UUID }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.warning).toBeDefined();
      expect(body.warning.code).toBe("EMPLOYEE_IS_DEPARTMENT_HEAD");
      expect(body.warning.message).toContain("DEP-001");
    });
  });

  describe("DELETE /api/empleados/[id]", () => {
    it("debe rechazar la eliminación con HTTP 400 si el colaborador es responsable activo de un departamento", async () => {
      vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
      vi.mocked(prisma.empleado.findUnique).mockResolvedValueOnce({
        id: EMP_UUID,
        codigo: "EMP-0001",
      } as any);

      vi.mocked(prisma.departamento.count).mockResolvedValueOnce(1); // Es responsable de 1 departamento

      const req = new NextRequest(`http://localhost:3000/api/empleados/${EMP_UUID}`, {
        method: "DELETE",
      });
      const res = await deleteEmpleado(req, {
        params: Promise.resolve({ id: EMP_UUID }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("EMPLOYEE_IS_ACTIVE_RESPONSIBLE");
      expect(prisma.empleado.delete).not.toHaveBeenCalled();
    });

    it("debe eliminar físicamente con HTTP 200 cuando no tiene restricciones", async () => {
      vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
      vi.mocked(prisma.empleado.findUnique).mockResolvedValueOnce({
        id: EMP_UUID,
        codigo: "EMP-0025",
      } as any);

      vi.mocked(prisma.departamento.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.empleado.delete).mockResolvedValueOnce({ id: EMP_UUID } as any);

      const req = new NextRequest(`http://localhost:3000/api/empleados/${EMP_UUID}`, {
        method: "DELETE",
      });
      const res = await deleteEmpleado(req, {
        params: Promise.resolve({ id: EMP_UUID }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(prisma.empleado.delete).toHaveBeenCalledWith({ where: { id: EMP_UUID } });
    });
  });
});
