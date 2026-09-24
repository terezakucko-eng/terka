"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/form";
import { Button, cx } from "./ui";

/**
 * <form> bound to a server action `(prev, formData) => FormState`,
 * showing its error / success message.
 */
/** Hosting (Vercel) rejects requests over ~4.5 MB – keep a safety margin. */
const MAX_REQUEST = 4.2 * 1024 * 1024;

function uploadSize(form: HTMLFormElement) {
  let total = 0;
  for (const el of Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]')))
    for (const f of Array.from(el.files ?? [])) total += f.size;
  return total;
}

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  confirm,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Ask before submitting (destructive actions). */
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) return e.preventDefault();
        if (uploadSize(e.currentTarget) > MAX_REQUEST) {
          e.preventDefault();
          window.alert("Fotky jsou dohromady moc velké na jedno uložení. Ulož je prosím po menších dávkách (např. 2–3 najednou).");
        }
      }}
    >
      {children}
      <FormMessage state={state} />
    </form>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p
      role={state.error ? "alert" : "status"}
      className={cx(
        "mt-3 rounded-xl px-4 py-2.5 text-sm",
        state.error ? "bg-chyba/10 text-chyba" : "bg-salvej/15 text-ok",
      )}
    >
      {state.error ?? state.ok}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingText = "Moment…",
  ...props
}: Parameters<typeof Button>[0] & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
