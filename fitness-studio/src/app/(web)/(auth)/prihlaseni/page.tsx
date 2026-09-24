import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Eyebrow, Field, Input } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getContent } from "@/content";

export const metadata: Metadata = { title: "Přihlášení" };

export default async function LoginPage({ searchParams }: PageProps<"/prihlaseni">) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(typeof next === "string" && next.startsWith("/") ? next : "/ucet");
  const nextQ = typeof next === "string" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <>
      <Eyebrow className="text-zeme">Můj účet</Eyebrow>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{(await getContent())("auth.loginTitle")}</h1>
      <ActionForm action={loginAction} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <Field label="E-mail"><Input name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Heslo"><Input name="password" type="password" autoComplete="current-password" required /></Field>
        <SubmitButton variant="dark" className="w-full">Přihlásit se</SubmitButton>
      </ActionForm>
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/zapomenute-heslo" className="text-les/60 underline underline-offset-4">Zapomenuté heslo</Link>
        <Link href={`/registrace${nextQ}`} className="font-semibold text-zeme underline underline-offset-4">Nemám účet</Link>
      </div>
    </>
  );
}
