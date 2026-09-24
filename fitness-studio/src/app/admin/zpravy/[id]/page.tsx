import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { deleteCampaignAction, sendTestAction, startCampaignAction } from "@/app/admin/messaging-actions";
import { AdminTitle, Stat, Table, Td } from "@/components/admin";
import { CampaignForm } from "@/components/campaign-form";
import { CampaignRunner } from "@/components/campaign-runner";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, Input } from "@/components/ui";
import { getDb } from "@/db";
import { campaignMessages, campaigns, users } from "@/db/schema";
import { audienceRecipients, segmentLabel } from "@/domain/campaigns";
import { audienceOptions } from "@/lib/admin-options";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { providerStatus } from "@/lib/messaging";
import { formatPhone } from "@/lib/phone";

const channelLabel = { email: "E-mail", sms: "SMS", whatsapp: "WhatsApp" } as const;

export default async function CampaignDetail({ params }: PageProps<"/admin/zpravy/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  if (!c) notFound();
  const provider = providerStatus()[c.channel];

  const title = (
    <>
      <Link href="/admin/zpravy" className="eyebrow text-les/60 hover:text-les">← Zprávy</Link>
      <AdminTitle title={c.name}>
        <Badge tone="dark">{channelLabel[c.channel]}</Badge>
        <Badge tone={c.purpose === "service" ? "gold" : "neutral"}>{c.purpose === "service" ? "Provozní" : "Novinky"}</Badge>
      </AdminTitle>
    </>
  );

  if (c.status !== "draft") {
    const failed = await db
      .select({ m: campaignMessages, u: users })
      .from(campaignMessages)
      .innerJoin(users, eq(campaignMessages.userId, users.id))
      .where(and(eq(campaignMessages.campaignId, c.id), eq(campaignMessages.status, "failed")))
      .limit(100);
    return (
      <>
        {title}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Příjemci" value={c.recipientCount} sub={segmentLabel[c.audience.segment]} />
          <Stat label="Odesláno" value={c.sentCount} sub={c.sentAt ? formatDateTime(c.sentAt) : "probíhá"} />
          <Stat label="Chyby" value={c.failedCount} />
        </div>
        {c.status === "sending" && (
          <div className="mt-6">
            <CampaignRunner id={c.id} total={c.recipientCount} sent={c.sentCount + c.failedCount} />
          </div>
        )}
        {failed.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-semibold">Nedoručené</h2>
            <Table head={["Klient", "Kontakt", "Chyba"]}>
              {failed.map(({ m, u }) => (
                <tr key={m.id}><Td>{u.name}</Td><Td>{m.to}</Td><Td className="text-xs text-chyba">{m.error}</Td></tr>
              ))}
            </Table>
          </section>
        )}
        <Card className="mt-8 max-w-2xl whitespace-pre-line text-sm">
          {c.subject && <p className="mb-3 font-semibold">{c.subject}</p>}
          {c.channel === "whatsapp" ? `Šablona: ${c.waTemplate} (${c.waLanguage}) · ${(c.waParams ?? []).join(", ")}` : c.body}
        </Card>
      </>
    );
  }

  const [opts, recipients] = await Promise.all([
    audienceOptions(db),
    audienceRecipients(db, c).catch(() => []),
  ]);

  return (
    <>
      {title}
      <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CampaignForm c={c} classTypes={opts.classTypes} sessions={opts.sessions} />
        </Card>
        <aside className="space-y-4">
          <Card>
            <p className="eyebrow text-les/60">Příjemci teď</p>
            <p className="mt-2 text-4xl font-light">{recipients.length}</p>
            <p className="mt-1 text-sm text-les/60">
              {segmentLabel[c.audience.segment]}
              {c.purpose === "marketing" || c.channel === "whatsapp" ? " · jen se souhlasem" : " · provozní zpráva"}
              {c.channel !== "email" && " · s telefonem"}
            </p>
            {recipients.length > 0 && (
              <p className="mt-3 text-xs text-les/50">
                {recipients.slice(0, 8).map((r) => r.name).join(", ")}
                {recipients.length > 8 && ` a ${recipients.length - 8} dalších`}
              </p>
            )}
          </Card>
          <Card>
            <h2 className="font-semibold">Testovací zpráva</h2>
            <ActionForm action={sendTestAction} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <Field label={c.channel === "email" ? "Pošli na e-mail" : "Pošli na telefon"}>
                <Input name="to" defaultValue={c.channel === "email" ? admin.email : admin.phone ? formatPhone(admin.phone) : ""} required />
              </Field>
              <SubmitButton variant="outline" className="w-full">Poslat test</SubmitButton>
            </ActionForm>
          </Card>
          <Card className="border-zlato">
            <h2 className="font-semibold">Odeslat</h2>
            {!provider && (
              <p className="mt-2 text-sm text-chyba">Poskytovatel pro tento kanál není nastaven – zprávy se jen zapíšou do logu. Klíče viz README.</p>
            )}
            <ActionForm action={startCampaignAction} className="mt-3" confirm={`Opravdu odeslat ${recipients.length} příjemcům? Nejde to vzít zpět.`}>
              <input type="hidden" name="id" value={c.id} />
              <SubmitButton variant="gold" className="w-full" disabled={!recipients.length}>
                Odeslat {recipients.length} příjemcům
              </SubmitButton>
            </ActionForm>
          </Card>
          <ActionForm action={deleteCampaignAction} confirm="Smazat koncept?">
            <input type="hidden" name="id" value={c.id} />
            <button className="text-xs font-semibold text-chyba underline">Smazat koncept</button>
          </ActionForm>
        </aside>
      </div>
    </>
  );
}
