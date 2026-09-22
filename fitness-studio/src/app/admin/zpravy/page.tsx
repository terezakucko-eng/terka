import Link from "next/link";
import { desc } from "drizzle-orm";
import { AdminTitle, Panel, Table, Td } from "@/components/admin";
import { CampaignForm } from "@/components/campaign-form";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { campaigns } from "@/db/schema";
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
      <div className="mb-8">
        <Panel title="+ Nová zpráva">
          <CampaignForm classTypes={opts.classTypes} sessions={opts.sessions} />
        </Panel>
      </div>
      <Table head={["Název", "Kanál", "Typ", "Stav", "Příjemci", "Doručeno", "Vytvořeno"]}>
        {list.map((c) => (
          <tr key={c.id}>
            <Td><Link href={`/admin/zpravy/${c.id}`} className="font-semibold text-zeme underline-offset-4 hover:underline">{c.name}</Link></Td>
            <Td>{channelLabel[c.channel]}</Td>
            <Td>{c.purpose === "service" ? "Provozní" : "Novinky"}</Td>
            <Td><Badge tone={c.status === "sent" ? "green" : c.status === "sending" ? "gold" : "neutral"}>{statusLabel[c.status]}</Badge></Td>
            <Td>{c.recipientCount || "—"}</Td>
            <Td>{c.status === "draft" ? "—" : `${c.sentCount}${c.failedCount ? ` (+${c.failedCount} chyb)` : ""}`}</Td>
            <Td className="whitespace-nowrap">{formatDateTime(c.createdAt)}</Td>
          </tr>
        ))}
        {list.length === 0 && <tr><Td className="text-les/50">Zatím žádné zprávy.</Td></tr>}
      </Table>
    </>
  );
}
