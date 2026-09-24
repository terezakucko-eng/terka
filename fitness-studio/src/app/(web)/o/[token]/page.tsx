import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { unsubscribeAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Container, Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const metadata: Metadata = { title: "Odhlášení z odběru", robots: { index: false } };

export default async function UnsubscribePage({ params }: PageProps<"/o/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) notFound();
  const [u] = await (await getDb()).select().from(users).where(eq(users.unsubscribeToken, token));
  if (!u) notFound();
  const active = [
    u.marketingConsent && "e-mailem",
    u.smsConsent && "SMS",
    u.whatsappConsent && "přes WhatsApp",
  ].filter(Boolean);

  return (
    <Container className="max-w-lg py-16">
      <Card>
        <Eyebrow className="text-zeme">Odběr novinek</Eyebrow>
        <h1 className="mt-3 text-3xl font-medium">Ahoj {u.name.split(" ")[0]},</h1>
        {active.length ? (
          <>
            <p className="mt-3 text-les/70">Teď od nás dostáváš novinky {active.join(", ")}. Mrzí nás, že odcházíš – odhlásit se můžeš jedním kliknutím.</p>
            <ActionForm action={unsubscribeAction} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <SubmitButton variant="dark">Odhlásit ze všech novinek</SubmitButton>
            </ActionForm>
            <p className="mt-4 text-xs text-les/50">Informace k tvým rezervacím (potvrzení, zrušení lekce) ti budeme posílat dál.</p>
          </>
        ) : (
          <p className="mt-3 text-les/70">Nejsi přihlášený/á k odběru žádných novinek. Kdyby sis to rozmyslel/a, zapneš je v profilu svého účtu.</p>
        )}
      </Card>
    </Container>
  );
}
