import Link from "next/link";

/** Required confirmation that the client may exercise (see terms, section 7). */
export function HealthCheckbox() {
  return (
    <label className="flex gap-3 text-sm text-les/80">
      <input type="checkbox" name="health" required className="mt-1 accent-[#674329]" />
      <span>
        Potvrzuji, že mi můj zdravotní stav dovoluje cvičit, případná omezení sdělím lektorovi a cvičím na vlastní odpovědnost
        (<Link href="/obchodni-podminky" className="underline" target="_blank">podmínky</Link>).
      </span>
    </label>
  );
}
