export class EmergencySafety {
  private static killSwitchEngaged = false;

  public static engageKillSwitch(): void {
    this.killSwitchEngaged = true;
  }

  public static isSafe(): boolean {
    return !this.killSwitchEngaged;
  }

  public static resetSafety(): void {
    this.killSwitchEngaged = false;
  }
}
