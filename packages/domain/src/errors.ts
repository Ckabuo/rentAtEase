/** Thrown by engines whose rules are specified but not implemented yet. */
export class NotImplemented extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented yet`);
    this.name = "NotImplemented";
  }
}
