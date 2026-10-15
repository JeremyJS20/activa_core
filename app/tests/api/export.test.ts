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
    },
    tipoActivo: {
      findMany: vi.fn(),
    },
    empleado: {
      findMany: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET as exportCatalogHandler } from "@/app/api/catalogos/export/route";

describe("API Route Handlers - Exportación de Catálogos (/api/catalogos/export)", () => {
  const readOnlyUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000003",
      nombre: "Auditor",
      correo: "auditor@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000003", codigo: "AUDITOR", nombre: "Auditor" },
      permisos: ["CAT_READ"],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Seguridad y Validación de Parámetros", () => {
    it("debe retornar HTTP 401 si no hay sesión autenticada", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost:3000/api/catalogos/export?catalogo=departamentos");
      const res = await exportCatalogHandler(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("debe retornar HTTP 403 si el usuario carece de permiso CAT_READ", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: "sin-perm", permisos: [] },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/catalogos/export?catalogo=departamentos");
      const res = await exportCatalogHandler(req);

      expect(res.status).toBe(403);
    });

    it("debe retornar HTTP 400 si el parámetro catalogo es inválido o no se envía", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);

      const req = new NextRequest("http://localhost:3000/api/catalogos/export?catalogo=inexistente");
      const res = await exportCatalogHandler(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("INVALID_CATALOG_PARAM");
    });

    it("debe retornar HTTP 400 si el formato solicitado no es soportado", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);

      const req = new NextRequest(
        "http://localhost:3000/api/catalogos/export?catalogo=departamentos&format=pdf"
      );
      const res = await exportCatalogHandler(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("INVALID_FORMAT_PARAM");
    });
  });

  describe("Exportación de Departamentos", () => {
    const mockDeptos = [
      {
        codigo: "DEP-001",
        descripcion: "Tecnología de la Información",
        estado: "ACTIVO",
        createdAt: new Date("2026-01-15T10:00:00Z"),
        responsable: {
          nombre: "Nikita",
          apellido: "Crist",
          correo: "nikita.crist@unapec.edu.do",
          cargo: "Director",
        },
        _count: { empleados: 12 },
      },
    ];

    it("debe exportar en CSV con preámbulo binario UTF-8 BOM [0xEF, 0xBB, 0xBF] para Excel en Windows", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.departamento.findMany).mockResolvedValueOnce(mockDeptos as any);

      const req = new NextRequest(
        "http://localhost:3000/api/catalogos/export?catalogo=departamentos&format=csv"
      );
      const res = await exportCatalogHandler(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
      expect(res.headers.get("Content-Disposition")).toContain(".csv");

      const buffer = Buffer.from(await res.arrayBuffer());
      // Verificación de los bytes del BOM UTF-8 (0xEF, 0xBB, 0xBF)
      expect(buffer[0]).toBe(0xef);
      expect(buffer[1]).toBe(0xbb);
      expect(buffer[2]).toBe(0xbf);

      const text = buffer.toString("utf-8");
      expect(text).toContain("DEP-001");
      expect(text).toContain("Tecnología de la Información");
      expect(text).toContain("Nikita Crist");
    });

    it("debe exportar en Excel (.xlsx) con buffer binario y cabecera de descarga", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.departamento.findMany).mockResolvedValueOnce(mockDeptos as any);

      const req = new NextRequest(
        "http://localhost:3000/api/catalogos/export?catalogo=departamentos&format=xlsx"
      );
      const res = await exportCatalogHandler(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(res.headers.get("Content-Disposition")).toContain(".xlsx");

      const buffer = await res.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(100);
    });
  });

  describe("Exportación de Tipos de Activos", () => {
    const mockTipos = [
      {
        codigo: "TPA-002",
        descripcion: "Equipos de Cómputo",
        cuentaContableCompra: "1-01-04-0020",
        cuentaContableDepreciacion: "1-01-04-0021",
        metodoDepreciacion: "DGII_CAT2",
        porcentajeDepreciacionAnual: 25.0,
        vidaUtilMeses: 48,
        estado: "ACTIVO",
        createdAt: new Date("2026-01-15T10:00:00Z"),
      },
    ];

    it("debe exportar tipos de activos a CSV con formato de porcentaje y BOM UTF-8", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.tipoActivo.findMany).mockResolvedValueOnce(mockTipos as any);

      const req = new NextRequest(
        "http://localhost:3000/api/catalogos/export?catalogo=tipos-activos&format=csv"
      );
      const res = await exportCatalogHandler(req);

      expect(res.status).toBe(200);
      const buffer = Buffer.from(await res.arrayBuffer());
      expect(buffer[0]).toBe(0xef);
      expect(buffer[1]).toBe(0xbb);
      expect(buffer[2]).toBe(0xbf);

      const text = buffer.toString("utf-8");
      expect(text).toContain("TPA-002");
      expect(text).toContain("DGII_CAT2");
      expect(text).toContain("25.00%");
    });
  });

  describe("Exportación de Empleados", () => {
    const mockEmpleados = [
      {
        codigo: "EMP-0001",
        nombre: "Nikita",
        apellido: "Crist",
        tipoPersona: "FISICA",
        cedula: "40200000004",
        departamento: { codigo: "DEP-001", descripcion: "Tecnología" },
        cargo: "Director TI",
        correo: "nikita.crist@unapec.edu.do",
        telefono: "(809) 555-1000",
        fechaIngreso: new Date("2020-03-15"),
        estado: "ACTIVO",
        departamentosResponsable: [{ codigo: "DEP-001" }],
      },
    ];

    it("debe exportar empleados a CSV formateando la cédula con guiones reglamentarios y BOM UTF-8", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.empleado.findMany).mockResolvedValueOnce(mockEmpleados as any);

      const req = new NextRequest(
        "http://localhost:3000/api/catalogos/export?catalogo=empleados&format=csv"
      );
      const res = await exportCatalogHandler(req);

      expect(res.status).toBe(200);
      const buffer = Buffer.from(await res.arrayBuffer());
      expect(buffer[0]).toBe(0xef);
      expect(buffer[1]).toBe(0xbb);
      expect(buffer[2]).toBe(0xbf);

      const text = buffer.toString("utf-8");
      expect(text).toContain("EMP-0001");
      expect(text).toContain("402-0000000-4"); // Cédula formateada
      expect(text).toContain("Sí (DEP-001)");
    });
  });
});
