/** Runs once when the server starts (see Next.js instrumentation). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.MIGRATE_ON_START === "true") {
    const { bootstrap } = await import("./db/bootstrap");
    await bootstrap();
  }
}
