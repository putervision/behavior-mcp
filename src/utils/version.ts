declare const __APP_VERSION__: string | undefined;

export function getVersion(): string {
  if (typeof __APP_VERSION__ !== 'undefined') {
    return __APP_VERSION__;
  }
  return '0.1.0';
}
