export class StuckDetector {
  private lastNodes: string[] = [];
  private maxHistory: number = 50;

  public checkStuck(currentNodePath: string): { isStuck: boolean; score: number } {
    this.lastNodes.push(currentNodePath);
    if (this.lastNodes.length > this.maxHistory) {
      this.lastNodes.shift();
    }

    if (this.lastNodes.length >= 30) {
      const allSame = this.lastNodes.every((p) => p === currentNodePath);
      if (allSame) {
        return { isStuck: true, score: 1.0 };
      }
    }

    return { isStuck: false, score: 0.0 };
  }
}
