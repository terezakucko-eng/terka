"use client";

/** Header checkbox ticking every `ids` checkbox in the same form. */
export function SelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Vybrat všechny zobrazené"
      className="size-4"
      onChange={(e) => {
        const form = e.currentTarget.form;
        form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((c) => (c.checked = e.currentTarget.checked));
      }}
    />
  );
}
