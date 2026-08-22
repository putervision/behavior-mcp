export class WatchdogTimer {
  private lastTickTime: number = Date.now();
  private maxAllowedDeltaMs: number;

  constructor(maxAllowedDeltaMs = 5000) {
    this.maxAllowedDeltaMs = maxAllowedDeltaMs;
  }

  public feed(): void {
    this.lastTickTime = Date.now();
  }

  public isExpired(): boolean {
    return Date.now() - this.lastTickTime > this.maxAllowedDeltaMs;
  }
}
