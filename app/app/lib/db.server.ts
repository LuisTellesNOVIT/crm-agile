// Prisma client singleton.
// El sufijo .server.ts hace que Vite excluya este módulo del bundle del
// cliente — solo lo carga en el servidor.
//
// Si DATABASE_URL no está seteada, la app todavía corre: los loaders deben
// captar el error y devolver datos vacíos (ver _app.tsx).
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export const isDbConfigured = Boolean(process.env.DATABASE_URL);
