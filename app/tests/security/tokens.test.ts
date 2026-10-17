import { describe, it, expect } from "vitest";
import { generateSecureToken, hashToken } from "@/lib/auth/tokens";
import crypto from "crypto";

describe("cryptoTokenUtils - Seguridad y Generación de Tokens", () => {
  it("debe generar un token criptográfico seguro de exactamente 64 caracteres hexadecimales (32 bytes)", () => {
    const token = generateSecureToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBe(64);
    expect(/^[a-f0-9]{64}$/.test(token)).toBe(true);
  });

  it("debe garantizar unicidad probabilística estricta entre múltiples tokens generados", () => {
    const set = new Set<string>();
    const count = 1000;
    for (let i = 0; i < count; i++) {
      set.add(generateSecureToken());
    }
    expect(set.size).toBe(count);
  });

  it("debe generar el hash SHA-256 canónico y determinista de un token", () => {
    const rawToken = "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef";
    const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const calculatedHash = hashToken(rawToken);
    expect(calculatedHash).toBe(expectedHash);
    expect(calculatedHash.length).toBe(64);
    expect(/^[a-f0-9]{64}$/.test(calculatedHash)).toBe(true);
  });

  it("debe producir hashes completamente distintos para entradas con una sola alteración de carácter (Avalanche Effect)", () => {
    const tokenA = "0000000000000000000000000000000000000000000000000000000000000001";
    const tokenB = "0000000000000000000000000000000000000000000000000000000000000002";

    const hashA = hashToken(tokenA);
    const hashB = hashToken(tokenB);

    expect(hashA).not.toBe(hashB);
  });
});
