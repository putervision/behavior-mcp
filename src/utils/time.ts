export function getCurrentIsoString(): string {
  return new Date().toISOString();
}

export function parseIsoString(iso: string): Date {
  return new Date(iso);
}

export function getElapsedTimeMs(startTimeIso: string): number {
  return Date.now() - new Date(startTimeIso).getTime();
}
