import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const destino = resolve(process.cwd(), "..", "backup", `pre-limpieza-${ts}`);
  mkdirSync(destino, { recursive: true });

  const tablas = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name
  `;

  const indice: Array<{ tabla: string; filas: number; archivo: string }> = [];

  for (const { table_name } of tablas) {
    const filas = await prisma.$queryRawUnsafe<Array<{ data: unknown }>>(
      `SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM "${table_name}" t`
    );
    const contenido = filas[0]?.data ?? [];
    const archivo = `${table_name}.json`;
    writeFileSync(resolve(destino, archivo), JSON.stringify(contenido, null, 2), "utf8");
    const cantidad = Array.isArray(contenido) ? contenido.length : 0;
    indice.push({ tabla: table_name, filas: cantidad, archivo });
  }

  writeFileSync(
    resolve(destino, "_indice.json"),
    JSON.stringify(
      {
        generadoEn: new Date().toISOString(),
        esquema: "public",
        motor: "PostgreSQL (Neon)",
        nota:
          "Respaldo logico fila-por-fila en JSON. Restaurable con scripts/restore-db.ts en orden inverso a las dependencias.",
        tablas: indice,
      },
      null,
      2
    ),
    "utf8"
  );

  const total = indice.reduce((acc, t) => acc + t.filas, 0);
  console.log(JSON.stringify({ destino, tablas: indice.length, filas: total, detalle: indice }, null, 2));
}

main().finally(() => prisma.$disconnect());
