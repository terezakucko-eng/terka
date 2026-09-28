"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
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

/** Pending state of the surrounding ActionForm (submits go through startTransition, not the form's action). */
const PendingContext = createContext(false);

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
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  // Submitting through `action={…}` would make React clear every field even when
  // the server says "fix this" – so submit manually and clear only after success.
  useEffect(() => {
    if (state?.ok && resetOnSuccess !== false) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const ask = submitter?.dataset.confirm ?? confirm;
        if (ask && !window.confirm(ask)) return;
        if (uploadSize(e.currentTarget) > MAX_REQUEST) {
          window.alert("Fotky jsou dohromady moc velké na jedno uložení. Ulož je prosím po menších dávkách (např. 2–3 najednou).");
          return;
        }
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
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
  const status = useFormStatus();
  const pending = useContext(PendingContext) || status.pending;
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
