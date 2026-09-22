import type { Metadata } from "next";
import { requestResetAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Eyebrow, Field, Input } from "@/components/ui";

export const metadata: Metadata = { title: "Zapomenuté heslo" };

export default function ForgotPage() {
  return (
    <>
      <Eyebrow className="text-zeme">Heslo</Eyebrow>
      <h1 className="mt-3 text-4xl font-medium tracking-tight">Zapomenuté heslo</h1>
      <p className="mt-3 text-les/70">Pošleme ti odkaz pro nastavení nového hesla.</p>
      <ActionForm action={requestResetAction} className="mt-8 space-y-4">
        <Field label="E-mail"><Input name="email" type="email" autoComplete="email" required /></Field>
        <SubmitButton className="w-full">Poslat odkaz</SubmitButton>
      </ActionForm>
    </>
  );
}
