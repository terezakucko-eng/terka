import Link from "next/link";
import { countDistinct, desc } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { deleteCampaignAction } from "@/app/admin/messaging-actions";
import { ActionForm } from "@/components/forms";
import { AdminTitle, Panel, Table, Td } from "@/components/admin";
import { CampaignForm } from "@/components/campaign-form";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { campaigns, pushSubscriptions } from "@/db/schema";
import { vapidKeys } from "@/lib/push";
import { PushPanel } from "@/components/push-panel";
import { audienceOptions } from "@/lib/admin-options";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { providerStatus } from "@/lib/messaging";

const channelLabel = { email: "E-mail", sms: "SMS", whatsapp: "WhatsApp" } as const;
const statusLabel = { draft: "Koncept", sending: "Odesílá se", sent: "Odesláno" } as const;

export default async function CampaignsPage() {
  await requireAdmin();
  const db = await getDb();
  const [list, opts] = await Promise.all([
    db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(100),
    audienceOptions(db),
  ]);
  const providers = providerStatus();
  const [{ publicKey }, [{ n: subscribers }]] = await Promise.all([
    vapidKeys(db),
    db.select({ n: countDistinct(pushSubscriptions.userId) }).from(pushSubscriptions),
  ]);

  return (
    <>
      <AdminTitle title="Zprávy klientům" />
      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {(["email", "sms", "whatsapp"] as const).map((ch) => (
          <Badge key={ch} tone={providers[ch] ? "green" : "neutral"}>
            {channelLabel[ch]}: {providers[ch] ?? "nenastaveno – jen do logu"}
          </Badge>
        ))}
      </div>
      <div className="mb-3">
        <Panel title={`Push notifikace do mobilu (${subscribers} s upozorněním)`}>
          <PushPanel publicKey={publicKey} subscribers={subscribers} />
        </Panel>
      </div>
      <div className="mb-8">
        <Panel title="+ Nová zpráva">
          <CampaignForm clients={opts.clients} classTypes={opts.classTypes} sessions={opts.sessions} />
        </Panel>
      </div>
      <Table head={["Název", "Kanál", "Typ", "Stav", "Příjemci", "Doručeno", "Vytvořeno", ""]}>
        {list.map((c) => (
          <tr key={c.id}>
            <Td><Link href={`/admin/zpravy/${c.id}`} className="font-semibold text-zeme underline-offset-4 hover:underline">{c.name}</Link></Td>
            <Td>{channelLabel[c.channel]}</Td>
            <Td>{c.purpose === "service" ? "Provozní" : "Novinky"}</Td>
            <Td><Badge tone={c.status === "sent" ? "green" : c.status === "sending" ? "gold" : "neutral"}>{statusLabel[c.status]}</Badge></Td>
            <Td>{c.recipientCount || "—"}</Td>
            <Td>{c.status === "draft" ? "—" : `${c.sentCount}${c.failedCount ? ` (+${c.failedCount} chyb)` : ""}`}</Td>
            <Td className="whitespace-nowrap">{formatDateTime(c.createdAt)}</Td>
            <Td>
              {c.status !== "sending" && (
                <ActionForm action={deleteCampaignAction} confirm={`Smazat zprávu „${c.name}“ z přehledu?`}>
                  <input type="hidden" name="id" value={c.id} />
                  <button title="Smazat" aria-label="Smazat" className="text-les/40 transition hover:text-chyba"><Trash2 className="size-4" /></button>
                </ActionForm>
              )}
            </Td>
          </tr>
        ))}
        {list.length === 0 && <tr><Td className="text-les/50">Zatím žádné zprávy.</Td></tr>}
      </Table>
    </>
  );
}
