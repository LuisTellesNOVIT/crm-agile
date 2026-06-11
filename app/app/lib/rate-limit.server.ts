// Rate limiter en memoria (sliding window) para frenar fuerza bruta en /login.
//
// Limitación conocida: en Vercel serverless cada instancia tiene su propia
// memoria, así que el límite es por-instancia (best effort). Aun así frena el
// caso real (ráfagas desde una misma conexión caliente) y no requiere Redis.
// Si el CRM crece, migrar a un contador en Postgres o Upstash.

const buckets = new Map<string, number[]>();
const MAX_KEYS = 5_000; // tope de memoria — limpia todo si se desborda

/** Registra un intento fallido para la clave. */
export function recordFailure(key: string) {
  if (buckets.size > MAX_KEYS) buckets.clear();
  const now = Date.now();
  const arr = buckets.get(key) ?? [];
  arr.push(now);
  buckets.set(key, arr);
}

/**
 * ¿La clave superó `max` fallos en los últimos `windowMs`?
 * Devuelve los segundos a esperar (0 = puede intentar).
 */
export function retryAfterSeconds(key: string, max: number, windowMs: number): number {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, arr);
  if (arr.length < max) return 0;
  const oldest = arr[0];
  return Math.ceil((oldest + windowMs - now) / 1000);
}

/** Limpia los fallos de la clave (tras un login exitoso). */
export function clearFailures(key: string) {
  buckets.delete(key);
}

/** IP del cliente detrás del proxy de Vercel. */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
