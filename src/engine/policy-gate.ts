export class PolicyGate {
  private deniedActions = new Set(['delete_item', 'spend_currency', 'irreversible_trade']);

  public isAllowed(actionName: string): boolean {
    return !this.deniedActions.has(actionName);
  }
}
