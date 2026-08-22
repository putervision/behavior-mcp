export class ActionRateLimiter {
  private actionTimestamps: number[] = [];
  private maxPerSecond: number;

  constructor(maxPerSecond = 60) {
    this.maxPerSecond = maxPerSecond;
  }

  public allowAction(): boolean {
    const now = Date.now();
    this.actionTimestamps = this.actionTimestamps.filter((t) => now - t < 1000);
    if (this.actionTimestamps.length >= this.maxPerSecond) {
      return false;
    }
    this.actionTimestamps.push(now);
    return true;
  }
}
