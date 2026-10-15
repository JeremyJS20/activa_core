import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock de autenticación NextAuth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock de Prisma Client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    departamento: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    empleado: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET as getDepartamentos, POST as createDepartamento } from "@/app/api/departamentos/route";
import {
  GET as getDepartamentoById,
  PUT as updateDepartamento,
  DELETE as deleteDepartamento,
} from "@/app/api/departamentos/[id]/route";

describe("API Route Handlers - Departamentos (/api/departamentos)", () => {
  const adminUserSession = {
    user: {
      id: "usr-admin-uuid",
      nombre: "Admin General",
      correo: "admin@unapec.edu.do",
      rol: { id: "rol-admin-uuid", codigo: "ADMIN", nombre: "Administrador General" },
      permisos: ["USER_ADMIN", "CAT_READ", "CAT_WRITE"],
    },
  };

  const operadorUserSession = {
    user: {
      id: "usr-op-uuid",
      nombre: "Operador Activos",
      correo: "operador@unapec.edu.do",
      rol: { id: "rol-op-uuid", codigo: "OPERADOR", nombre: "Operador de Activos" },
      permisos: ["CAT_READ", "CAT_WRITE"],
    },
  };

  const readOnlyUserSession = {
    user: {
      id: "usr-auditor-uuid",
      nombre: "Auditor",
      correo: "auditor@unapec.edu.do",
      rol: { id: "rol-aud-uuid", codigo: "AUDITOR", nombre: "Auditor" },
      permisos: ["CAT_READ"],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/departamentos", () => {
    it("debe retornar HTTP 401 si no hay sesión autenticada", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos");
      const res = await getDepartamentos(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("debe retornar HTTP 403 si el usuario no tiene permiso CAT_READ", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: "usr-no-perm",
          nombre: "Sin Permisos",
          correo: "noperm@unapec.edu.do",
          rol: { id: "rol-sin-perm", codigo: "INVITADO", nombre: "Invitado" },
          permisos: [],
        },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos");
      const res = await getDepartamentos(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("FORBIDDEN");
    });

    it("debe retornar HTTP 400 si los parámetros de paginación son inválidos", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos?page=-1&limit=500");
      const res = await getDepartamentos(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("INVALID_QUERY_PARAMS");
    });

    it("debe retornar HTTP 200 con la lista paginada de departamentos y conteo de empleados", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);

      const mockDepartamentos = [
        {
          id: "dept-1",
          codigo: "DEP-001",
          descripcion: "Dirección de Tecnología de la Información",
          estado: "ACTIVO",
          createdAt: new Date(),
          updatedAt: new Date(),
          responsable: {
            id: "emp-1",
            codigo: "EMP-0001",
            nombre: "Jeremy",
            apellido: "Santos",
            correo: "jsantos@unapec.edu.do",
            cargo: "Director TI",
          },
          _count: {
            empleados: 8,
          },
        },
      ];

      vi.mocked(prisma.departamento.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.departamento.findMany).mockResolvedValueOnce(mockDepartamentos as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos?page=1&limit=10");
      const res = await getDepartamentos(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].codigo).toBe("DEP-001");
      expect(body.data[0].totalEmpleados).toBe(8);
      expect(body.data[0].responsable?.nombre).toBe("Jeremy");
      expect(body.pagination.total).toBe(1);
      expect(body.pagination.page).toBe(1);
    });
  });

  describe("POST /api/departamentos", () => {
    it("debe retornar HTTP 403 si el usuario solo tiene lectura y carece de CAT_WRITE", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos", {
        method: "POST",
        body: JSON.stringify({ descripcion: "Nuevo Departamento" }),
      });
      const res = await createDepartamento(req);

      expect(res.status).toBe(403);
    });

    it("debe retornar HTTP 422 si la descripción tiene menos de 3 caracteres", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos", {
        method: "POST",
        body: JSON.stringify({ descripcion: "AB" }),
      });
      const res = await createDepartamento(req);

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toBe("VALIDATION_FAILED");
    });

    it("debe retornar HTTP 409 si ya existe un departamento con la misma descripción (case-insensitive)", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findFirst).mockResolvedValueOnce({
        id: "dept-existente",
        codigo: "DEP-001",
        descripcion: "Tecnología",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos", {
        method: "POST",
        body: JSON.stringify({ descripcion: "tecnología" }),
      });
      const res = await createDepartamento(req);

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("DEPT_DUPLICATE_NAME");
    });

    it("debe autogenerar el siguiente código correlativo DEP-011 y retornar HTTP 201 Created", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findFirst).mockResolvedValueOnce(null); // No duplicado por descripción

      // Simular búsqueda de existentes para autogenerar correlativo
      vi.mocked(prisma.departamento.findMany).mockResolvedValueOnce([
        { codigo: "DEP-001" },
        { codigo: "DEP-009" },
        { codigo: "DEP-010" },
      ] as any);

      const createdDepto = {
        id: "dept-new-uuid",
        codigo: "DEP-011",
        descripcion: "Departamento de Innovación",
        responsableId: null,
        responsable: null,
        estado: "ACTIVO",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.departamento.create).mockResolvedValueOnce(createdDepto as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos", {
        method: "POST",
        body: JSON.stringify({
          descripcion: "Departamento de Innovación",
        }),
      });
      const res = await createDepartamento(req);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.codigo).toBe("DEP-011");
      expect(body.descripcion).toBe("Departamento de Innovación");
      expect(prisma.departamento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            codigo: "DEP-011",
            descripcion: "Departamento de Innovación",
            estado: "ACTIVO",
          }),
        })
      );
    });

    it("debe retornar HTTP 404 si el responsable especificado no existe", async () => {
      vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
      vi.mocked(prisma.departamento.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.departamento.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.empleado.findUnique).mockResolvedValueOnce(null); // Empleado no existe

      const req = new NextRequest("http://localhost:3000/api/departamentos", {
        method: "POST",
        body: JSON.stringify({
          descripcion: "Departamento con Responsable Fantasma",
          responsableId: "00000000-0000-0000-0000-000000000000",
        }),
      });
      const res = await createDepartamento(req);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("RESPONSIBLE_NOT_FOUND");
    });
  });

  describe("GET /api/departamentos/[id]", () => {
    it("debe retornar HTTP 404 si el departamento no existe", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/departamentos/inexistente-id");
      const res = await getDepartamentoById(req, {
        params: Promise.resolve({ id: "inexistente-id" }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("DEPT_NOT_FOUND");
    });

    it("debe retornar HTTP 200 con la información detallada del departamento", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce({
        id: "dept-10",
        codigo: "DEP-010",
        descripcion: "Decanato de Ciencias Económicas",
        estado: "ACTIVO",
        createdAt: new Date(),
        updatedAt: new Date(),
        responsable: {
          id: "emp-10",
          codigo: "EMP-0010",
          nombre: "Breanne",
          apellido: "Yost",
          correo: "breanne.yost@unapec.edu.do",
          cargo: "Decana",
        },
        _count: {
          empleados: 5,
        },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos/dept-10");
      const res = await getDepartamentoById(req, {
        params: Promise.resolve({ id: "dept-10" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.codigo).toBe("DEP-010");
      expect(body.totalEmpleados).toBe(5);
    });
  });

  describe("PUT /api/departamentos/[id]", () => {
    it("debe retornar HTTP 404 si el departamento a actualizar no existe", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/departamentos/no-dept", {
        method: "PUT",
        body: JSON.stringify({ descripcion: "Nueva Descripción" }),
      });
      const res = await updateDepartamento(req, {
        params: Promise.resolve({ id: "no-dept" }),
      });

      expect(res.status).toBe(404);
    });

    it("debe retornar HTTP 409 si el cambio de descripción causa conflicto con otro departamento", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce({
        id: "dept-1",
        codigo: "DEP-001",
        descripcion: "Tecnología",
      } as any);

      vi.mocked(prisma.departamento.findFirst).mockResolvedValueOnce({
        id: "dept-2",
        codigo: "DEP-002",
        descripcion: "Finanzas",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos/dept-1", {
        method: "PUT",
        body: JSON.stringify({ descripcion: "Finanzas" }),
      });
      const res = await updateDepartamento(req, {
        params: Promise.resolve({ id: "dept-1" }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("DEPT_DUPLICATE_NAME");
    });

    it("debe actualizar correctamente y retornar HTTP 200", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce({
        id: "dept-1",
        codigo: "DEP-001",
        descripcion: "Tecnología de la Información",
        estado: "ACTIVO",
      } as any);

      vi.mocked(prisma.departamento.findFirst).mockResolvedValueOnce(null); // Sin duplicados

      vi.mocked(prisma.departamento.update).mockResolvedValueOnce({
        id: "dept-1",
        codigo: "DEP-001",
        descripcion: "Dirección General de Tecnologías de Información (DGTI)",
        estado: "ACTIVO",
        responsableId: null,
        responsable: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { empleados: 12 },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos/dept-1", {
        method: "PUT",
        body: JSON.stringify({
          descripcion: "Dirección General de Tecnologías de Información (DGTI)",
        }),
      });
      const res = await updateDepartamento(req, {
        params: Promise.resolve({ id: "dept-1" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.descripcion).toContain("DGTI");
    });
  });

  describe("DELETE /api/departamentos/[id]", () => {
    it("debe rechazar la eliminación con HTTP 400 y DEPT_HAS_ACTIVE_EMPLOYEES si tiene dependencias foráneas", async () => {
      vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce({
        id: "dept-con-empleados",
        codigo: "DEP-001",
      } as any);

      // Simular que tiene 3 empleados asignados
      vi.mocked(prisma.empleado.count).mockResolvedValueOnce(3);

      const req = new NextRequest("http://localhost:3000/api/departamentos/dept-con-empleados", {
        method: "DELETE",
      });
      const res = await deleteDepartamento(req, {
        params: Promise.resolve({ id: "dept-con-empleados" }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("DEPT_HAS_ACTIVE_EMPLOYEES");
      expect(body.totalEmpleados).toBe(3);
      expect(prisma.departamento.delete).not.toHaveBeenCalled();
    });

    it("debe eliminar exitosamente con HTTP 200 cuando no posee empleados asociados", async () => {
      vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce({
        id: "dept-vacio",
        codigo: "DEP-099",
      } as any);

      vi.mocked(prisma.empleado.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.departamento.delete).mockResolvedValueOnce({
        id: "dept-vacio",
        codigo: "DEP-099",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/departamentos/dept-vacio", {
        method: "DELETE",
      });
      const res = await deleteDepartamento(req, {
        params: Promise.resolve({ id: "dept-vacio" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(prisma.departamento.delete).toHaveBeenCalledWith({
        where: { id: "dept-vacio" },
      });
    });
  });
});
