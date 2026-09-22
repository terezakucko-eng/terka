/** An error whose message is safe to show to the user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof UserError) return e.message;
  console.error(e);
  return "Něco se pokazilo. Zkus to prosím znovu.";
}
