import { describe, it, expect } from "vitest";
import {
  DepartmentCreateSchema,
  DepartmentUpdateSchema,
} from "../../lib/schemas/department.schema";
import {
  AssetTypeCreateSchema,
  AssetTypeUpdateSchema,
} from "../../lib/schemas/asset-type.schema";
import {
  EmployeeCreateSchema,
  EmployeeUpdateSchema,
} from "../../lib/schemas/employee.schema";

describe("DepartmentCreateSchema & DepartmentUpdateSchema", () => {
  it("debe validar exitosamente un departamento con datos mínimos requeridos", () => {
    const valid = DepartmentCreateSchema.safeParse({
      descripcion: "Tecnología de la Información",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.descripcion).toBe("Tecnología de la Información");
      expect(valid.data.estado).toBe("ACTIVO");
    }
  });

  it("debe aceptar código correlativo y responsableId UUID opcionales", () => {
    const valid = DepartmentCreateSchema.safeParse({
      codigo: "DEP-001",
      descripcion: "Recursos Humanos",
      responsableId: "550e8400-e29b-41d4-a716-446655440000",
      estado: "ACTIVO",
    });
    expect(valid.success).toBe(true);
  });

  it("debe rechazar descripción con menos de 3 caracteres", () => {
    const invalid = DepartmentCreateSchema.safeParse({
      descripcion: "TI",
    });
    expect(invalid.success).toBe(false);
  });

  it("debe rechazar responsableId que no sea un UUID válido", () => {
    const invalid = DepartmentCreateSchema.safeParse({
      descripcion: "Finanzas y Contabilidad",
      responsableId: "12345-invalido",
    });
    expect(invalid.success).toBe(false);
  });

  it("debe permitir actualización parcial en DepartmentUpdateSchema", () => {
    const valid = DepartmentUpdateSchema.safeParse({
      estado: "INACTIVO",
    });
    expect(valid.success).toBe(true);
  });
});

describe("AssetTypeCreateSchema & AssetTypeUpdateSchema", () => {
  it("debe validar exitosamente un tipo de activo válido con cuentas contables distintas", () => {
    const valid = AssetTypeCreateSchema.safeParse({
      descripcion: "Equipos de Computación",
      cuentaContableCompra: "1-01-04-0001",
      cuentaContableDepreciacion: "1-02-01-0010",
      metodoDepreciacion: "DGII_CAT2",
      porcentajeDepreciacionAnual: 25.0,
      vidaUtilMeses: 48,
    });
    expect(valid.success).toBe(true);
  });

  it("debe rechazar cuentas contables de compra y depreciación idénticas", () => {
    const invalid = AssetTypeCreateSchema.safeParse({
      descripcion: "Mobiliario de Oficina",
      cuentaContableCompra: "1-01-04-0001",
      cuentaContableDepreciacion: "1-01-04-0001", // IDÉNTICA
      metodoDepreciacion: "DGII_CAT2",
      porcentajeDepreciacionAnual: 25.0,
      vidaUtilMeses: 48,
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0].message).toContain("no pueden ser idénticas");
    }
  });

  it("debe rechazar formatos contables que violen la máscara X-XX-XX-XXXX", () => {
    const invalid = AssetTypeCreateSchema.safeParse({
      descripcion: "Vehículos Livianos",
      cuentaContableCompra: "101040001", // Sin guiones
      cuentaContableDepreciacion: "1-02-01-0010",
      metodoDepreciacion: "DGII_CAT2",
      porcentajeDepreciacionAnual: 25.0,
      vidaUtilMeses: 48,
    });
    expect(invalid.success).toBe(false);
  });

  it("debe rechazar porcentaje de depreciación menor o igual a 0 o mayor a 100", () => {
    const invalidZero = AssetTypeCreateSchema.safeParse({
      descripcion: "Edificio Administrativo",
      cuentaContableCompra: "1-01-01-0001",
      cuentaContableDepreciacion: "1-02-01-0001",
      metodoDepreciacion: "DGII_CAT1",
      porcentajeDepreciacionAnual: 0.0,
      vidaUtilMeses: 240,
    });
    expect(invalidZero.success).toBe(false);

    const invalidOver100 = AssetTypeCreateSchema.safeParse({
      descripcion: "Edificio Administrativo",
      cuentaContableCompra: "1-01-01-0001",
      cuentaContableDepreciacion: "1-02-01-0001",
      metodoDepreciacion: "DGII_CAT1",
      porcentajeDepreciacionAnual: 105.0,
      vidaUtilMeses: 240,
    });
    expect(invalidOver100.success).toBe(false);
  });
});

describe("EmployeeCreateSchema & EmployeeUpdateSchema", () => {
  const validDeptId = "550e8400-e29b-41d4-a716-446655440000";

  it("debe validar exitosamente un empleado persona física con cédula JCE válida", () => {
    const valid = EmployeeCreateSchema.safeParse({
      nombre: "Carlos",
      apellido: "Méndez",
      tipoPersona: "FISICA",
      cedula: "402-0000000-4",
      departamentoId: validDeptId,
      cargo: "Encargado de Soporte Técnico",
      correo: "cmendez@unapec.edu.do",
      telefono: "809-555-1234",
      fechaIngreso: "2024-01-15",
    });
    expect(valid.success).toBe(true);
  });

  it("debe validar persona jurídica con RNC válido de 9 dígitos", () => {
    const valid = EmployeeCreateSchema.safeParse({
      nombre: "Proveedor",
      apellido: "Institucional SRL",
      tipoPersona: "JURIDICA",
      cedula: "1-01-00624-2",
      departamentoId: validDeptId,
      cargo: "Custodio Contratista",
      fechaIngreso: "2023-05-10",
    });
    expect(valid.success).toBe(true);
  });

  it("debe rechazar persona física con cédula inválida según Módulo 10", () => {
    const invalid = EmployeeCreateSchema.safeParse({
      nombre: "Juan",
      apellido: "Pérez",
      tipoPersona: "FISICA",
      cedula: "402-0000000-5", // Dígito incorrecto
      departamentoId: validDeptId,
      cargo: "Analista de Sistemas",
      fechaIngreso: "2024-02-01",
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0].message).toContain("no supera la validación matemática");
    }
  });

  it("debe rechazar fecha de contratación futura", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const invalid = EmployeeCreateSchema.safeParse({
      nombre: "Ana",
      apellido: "Gómez",
      tipoPersona: "FISICA",
      cedula: "402-0000000-4",
      departamentoId: validDeptId,
      cargo: "Directora de Finanzas",
      fechaIngreso: futureDate.toISOString(),
    });
    expect(invalid.success).toBe(false);
  });

  it("debe rechazar correo electrónico con formato inválido", () => {
    const invalid = EmployeeCreateSchema.safeParse({
      nombre: "Pedro",
      apellido: "Díaz",
      tipoPersona: "FISICA",
      cedula: "402-0000000-4",
      departamentoId: validDeptId,
      cargo: "Docente",
      correo: "correo_invalido_sin_arroba",
      fechaIngreso: "2024-01-01",
    });
    expect(invalid.success).toBe(false);
  });
});
