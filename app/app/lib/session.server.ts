import { createCookieSessionStorage, redirect } from "react-router";
import { prisma } from "./db.server";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET no configurada en producción.");
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "crm_session",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    secrets: [SESSION_SECRET ?? "dev-only-insecure-secret"],
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
});

export function getSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function commitSession(
  session: Awaited<ReturnType<typeof getSession>>,
) {
  return storage.commitSession(session);
}

export async function destroySession(
  session: Awaited<ReturnType<typeof getSession>>,
) {
  return storage.destroySession(session);
}

/**
 * Loader helper: extrae el usuario logueado de la cookie.
 * Devuelve null si no hay sesión válida.
 */
export async function getCurrentUser(request: Request) {
  const session = await getSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      initials: true,
      color: true,
      permissions: true,
      workspaceId: true,
      workspace: { select: { slug: true, name: true } },
    },
  });
  return user;
}

/**
 * Loader helper que tira redirect("/login") si no hay sesión.
 * Usar en loaders/actions que necesitan auth.
 */
export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    const url = new URL(request.url);
    const search = url.pathname === "/" ? "" : `?next=${encodeURIComponent(url.pathname + url.search)}`;
    throw redirect(`/login${search}`);
  }
  return user;
}
