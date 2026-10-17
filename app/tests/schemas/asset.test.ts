import { describe, it, expect } from "vitest";
import {
  CreateAssetSchema,
  UpdateAssetSchema,
  TransferCustodySchema,
  DisposeAssetSchema,
  AssetFilterSchema,
} from "../../lib/schemas/asset.schema";

describe("Schemas de Validación de Activos Fijos (asset.schema)", () => {
  const validUuid1 = "e7b1a23c-4d5e-4f7a-8b9c-0d1e2f3a4b5c";
  const validUuid2 = "a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d";
  const validUuid3 = "c3d4e5f6-a7b8-4c0d-8e1f-2a3b4c5d6e7f";

  describe("CreateAssetSchema", () => {
    const validAsset = {
      descripcion: "Laptop Dell Latitude 5440 i7 16GB",
      tipoActivoId: validUuid1,
      departamentoId: validUuid2,
      empleadoId: validUuid3,
      fechaAdquisicion: "2026-01-15",
      costoAdquisicion: 85000.0,
      valorResidual: 8500.0,
      marca: "Dell",
      modelo: "Latitude 5440",
      numeroSerie: "DL-99887766",
      ubicacionFisica: "Edificio 1 - Piso 3",
      color: "Gris",
    };

    it("debe validar un payload completo correcto", () => {
      const parsed = CreateAssetSchema.safeParse(validAsset);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.costoAdquisicion).toBe(85000.0);
        expect(parsed.data.valorResidual).toBe(8500.0);
        expect(parsed.data.estado).toBe("ACTIVO");
      }
    });

    it("debe aceptar código correlativo opcional con formato ACT-YYYY-NNNN", () => {
      const parsed = CreateAssetSchema.safeParse({
        ...validAsset,
        codigo: "ACT-2026-0001",
      });
      expect(parsed.success).toBe(true);
    });

    it("debe rechazar costo de adquisición menor o igual a cero", () => {
      const parsedZero = CreateAssetSchema.safeParse({
        ...validAsset,
        costoAdquisicion: 0,
      });
      expect(parsedZero.success).toBe(false);

      const parsedNegative = CreateAssetSchema.safeParse({
        ...validAsset,
        costoAdquisicion: -500,
      });
      expect(parsedNegative.success).toBe(false);
    });

    it("debe rechazar valor residual negativo", () => {
      const parsed = CreateAssetSchema.safeParse({
        ...validAsset,
        valorResidual: -100,
      });
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar valor residual superior al costo de adquisición", () => {
      const parsed = CreateAssetSchema.safeParse({
        ...validAsset,
        costoAdquisicion: 50000,
        valorResidual: 60000,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const error = parsed.error.issues.find((i) => i.path.includes("valorResidual"));
        expect(error?.message).toContain("no puede ser superior al costo");
      }
    });

    it("debe rechazar fecha de adquisición futura", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const parsed = CreateAssetSchema.safeParse({
        ...validAsset,
        fechaAdquisicion: futureDate.toISOString().split("T")[0],
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const error = parsed.error.issues.find((i) => i.path.includes("fechaAdquisicion"));
        expect(error?.message).toContain("no puede ser posterior a la fecha actual");
      }
    });

    it("debe rechazar UUIDs inválidos en relaciones foráneas", () => {
      const parsed = CreateAssetSchema.safeParse({
        ...validAsset,
        tipoActivoId: "not-a-uuid",
      });
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar descripción con menos de 3 caracteres", () => {
      const parsed = CreateAssetSchema.safeParse({
        ...validAsset,
        descripcion: "AB",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("UpdateAssetSchema", () => {
    it("debe permitir actualización parcial de metadatos físicos", () => {
      const updateData = {
        marca: "HP",
        modelo: "EliteBook 840",
        color: "Negro",
      };
      const parsed = UpdateAssetSchema.safeParse(updateData);
      expect(parsed.success).toBe(true);
    });

    it("debe rechazar valor residual superior al costo cuando ambos se actualizan", () => {
      const updateData = {
        costoAdquisicion: 20000,
        valorResidual: 25000,
      };
      const parsed = UpdateAssetSchema.safeParse(updateData);
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar fecha de adquisición futura en actualización", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);

      const parsed = UpdateAssetSchema.safeParse({
        fechaAdquisicion: futureDate.toISOString(),
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("TransferCustodySchema", () => {
    const validTransfer = {
      empleadoNuevoId: validUuid1,
      departamentoNuevoId: validUuid2,
      motivo: "ROTACION_INTERNA",
      justificacion: "Reasignación por rotación departamental del personal de TI",
    };

    it("debe validar un traslado de custodia con justificación adecuada", () => {
      const parsed = TransferCustodySchema.safeParse(validTransfer);
      expect(parsed.success).toBe(true);
    });

    it("debe rechazar justificaciones con menos de 10 caracteres", () => {
      const parsed = TransferCustodySchema.safeParse({
        ...validTransfer,
        justificacion: "Rotación",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const error = parsed.error.issues.find((i) => i.path.includes("justificacion"));
        expect(error?.message).toContain("al menos 10 caracteres");
      }
    });

    it("debe rechazar motivos de custodia desconocidos", () => {
      const parsed = TransferCustodySchema.safeParse({
        ...validTransfer,
        motivo: "MOTIVO_INVENTADO",
      });
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar UUIDs inválidos para el nuevo custodio", () => {
      const parsed = TransferCustodySchema.safeParse({
        ...validTransfer,
        empleadoNuevoId: "123-invalid",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("DisposeAssetSchema", () => {
    const validDisposal = {
      motivoBaja: "DANO_IRREPARABLE",
      numeroActa: "ACTA-BAJA-2026-004",
      justificacion: "Falla catastrófica de tarjeta madre sin repuestos disponibles en el mercado nacional",
      fechaBaja: "2026-03-01",
    };

    it("debe validar una solicitud de baja formal con dictamen técnico", () => {
      const parsed = DisposeAssetSchema.safeParse(validDisposal);
      expect(parsed.success).toBe(true);
    });

    it("debe rechazar justificaciones de baja con menos de 20 caracteres", () => {
      const parsed = DisposeAssetSchema.safeParse({
        ...validDisposal,
        justificacion: "Se dañó el equipo",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const error = parsed.error.issues.find((i) => i.path.includes("justificacion"));
        expect(error?.message).toContain("al menos 20 caracteres");
      }
    });

    it("debe rechazar actas de baja con número de acta vacío o menor a 3 caracteres", () => {
      const parsed = DisposeAssetSchema.safeParse({
        ...validDisposal,
        numeroActa: "AB",
      });
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar motivos de baja no contemplados en la norma DGII", () => {
      const parsed = DisposeAssetSchema.safeParse({
        ...validDisposal,
        motivoBaja: "REGALO",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("AssetFilterSchema", () => {
    it("debe aplicar valores por defecto correctos", () => {
      const parsed = AssetFilterSchema.safeParse({});
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBe(1);
        expect(parsed.data.pageSize).toBe(10);
        expect(parsed.data.estado).toBe("TODOS");
        expect(parsed.data.sortOrder).toBe("desc");
      }
    });

    it("debe parsear y coercionar parámetros de filtrado y paginación", () => {
      const parsed = AssetFilterSchema.safeParse({
        search: "Latitude",
        page: "3",
        pageSize: "25",
        estado: "ACTIVO",
        sortBy: "costoAdquisicion",
        sortOrder: "asc",
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBe(3);
        expect(parsed.data.pageSize).toBe(25);
        expect(parsed.data.search).toBe("Latitude");
        expect(parsed.data.estado).toBe("ACTIVO");
        expect(parsed.data.sortBy).toBe("costoAdquisicion");
        expect(parsed.data.sortOrder).toBe("asc");
      }
    });
  });
});