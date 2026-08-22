export function safeJsonParse<T = any>(str: string | null | undefined, fallback: T): T {
  if (!str || typeof str !== 'string') return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export function safeJsonStringify(obj: unknown, fallback = '{}'): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return fallback;
  }
}
