import { unstable_rethrow } from "next/navigation";
import { errorMessage } from "./errors";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};

export const field = {
  str,
  optional: (fd: FormData, k: string) => str(fd, k) || null,
  int: (fd: FormData, k: string) => {
    const v = str(fd, k);
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  },
  /** "250" or "250,50" Kč → haléře */
  money: (fd: FormData, k: string) => {
    const v = str(fd, k).replace(/\s/g, "").replace(",", ".");
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  },
  bool: (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true",
};

/** Wraps a mutation so thrown UserErrors become a form message. */
export async function attempt(fn: () => Promise<string | void>): Promise<FormState> {
  try {
    const ok = await fn();
    return { ok: ok ?? "Uloženo." };
  } catch (e) {
    unstable_rethrow(e); // let redirect()/notFound() through
    return { error: errorMessage(e) };
  }
}
