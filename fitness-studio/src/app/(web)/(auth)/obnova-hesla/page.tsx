import type { Metadata } from "next";
import { resetPasswordAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Eyebrow, Field } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";

export const metadata: Metadata = { title: "Nové heslo" };

export default async function ResetPage({ searchParams }: PageProps<"/obnova-hesla">) {
  const { token } = await searchParams;
  return (
    <>
      <Eyebrow className="text-zeme">Heslo</Eyebrow>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Nastav si nové heslo</h1>
      <ActionForm action={resetPasswordAction} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={typeof token === "string" ? token : ""} />
        <Field label="Nové heslo" hint="Alespoň 8 znaků."><PasswordInput name="password" autoComplete="new-password" minLength={8} required /></Field>
        <SubmitButton className="w-full">Uložit heslo</SubmitButton>
      </ActionForm>
    </>
  );
}
