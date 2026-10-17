import { describe, it, expect } from "vitest";
import { hashPassword, comparePassword } from "@/lib/auth/crypto";

describe("bcryptUtils - Hashing y Verificación Criptográfica", () => {
  const plainPassword = "Password2026!Seguro";

  it("debe generar un hash bcrypt válido con prefijo $2a$ o $2b$", async () => {
    const hash = await hashPassword(plainPassword);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
    expect(/^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)).toBe(true);
  });

  it("debe generar hashes distintos para la misma contraseña gracias al salt dinámico de 10 rondas", async () => {
    const hash1 = await hashPassword(plainPassword);
    const hash2 = await hashPassword(plainPassword);

    expect(hash1).not.toBe(hash2);
  });

  it("debe verificar satisfactoriamente la contraseña correcta contra el hash generado", async () => {
    const hash = await hashPassword(plainPassword);
    const isValid = await comparePassword(plainPassword, hash);

    expect(isValid).toBe(true);
  });

  it("debe rechazar una contraseña incorrecta o manipulada", async () => {
    const hash = await hashPassword(plainPassword);
    const isValid = await comparePassword("Password2026!Incorrecto", hash);

    expect(isValid).toBe(false);
  });

  it("debe retornar false de forma segura si la contraseña comparada está vacía", async () => {
    const hash = await hashPassword(plainPassword);
    const isValid = await comparePassword("", hash);

    expect(isValid).toBe(false);
  });
});
