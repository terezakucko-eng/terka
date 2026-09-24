import type { Metadata } from "next";
import { resetPasswordAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Eyebrow, Field, Input } from "@/components/ui";

export const metadata: Metadata = { title: "Nové heslo" };

export default async function ResetPage({ searchParams }: PageProps<"/obnova-hesla">) {
  const { token } = await searchParams;
  return (
    <>
      <Eyebrow className="text-zeme">Heslo</Eyebrow>
      <h1 className="mt-3 text-4xl font-medium tracking-tight">Nastav si nové heslo</h1>
      <ActionForm action={resetPasswordAction} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={typeof token === "string" ? token : ""} />
        <Field label="Nové heslo" hint="Alespoň 8 znaků."><Input name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
        <SubmitButton className="w-full">Uložit heslo</SubmitButton>
      </ActionForm>
    </>
  );
}
