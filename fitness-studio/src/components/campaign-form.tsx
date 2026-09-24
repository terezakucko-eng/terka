"use client";

import { useState } from "react";
import { saveCampaignAction } from "@/app/admin/messaging-actions";
import type { Campaign } from "@/db/schema";
import { smsParts } from "@/lib/newsletter";
import { ActionForm, SubmitButton } from "./forms";
import { Field, Input, Select, Textarea } from "./ui";

type Opt = { id: string; label: string };

const segments = [
  ["all", "Všichni klienti"],
  ["members", "Aktivní členové"],
  ["passes", "Držitelé platné permanentky"],
  ["inactive", "Neaktivní – bez lekce posledních X dní"],
  ["new", "Noví – registrace za posledních X dní"],
  ["class_type", "Chodí na typ lekce (posledních X dní)"],
  ["session", "Přihlášení na konkrétní termín"],
] as const;

export function CampaignForm({
  c,
  classTypes,
  sessions,
}: {
  c?: Campaign;
  classTypes: Opt[];
  sessions: Opt[];
}) {
  const [channel, setChannel] = useState<Campaign["channel"]>(c?.channel ?? "email");
  const [segment, setSegment] = useState<string>(c?.audience.segment ?? "all");
  const [body, setBody] = useState(c?.body ?? "");
  const sms = smsParts(body);

  return (
    <ActionForm action={saveCampaignAction} className="space-y-5">
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Kanál">
          <Select name="channel" value={channel} onChange={(e) => setChannel(e.target.value as Campaign["channel"])}>
            <option value="email">E-mail / newsletter</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </Select>
        </Field>
        <Field label="Typ zprávy" hint="Provozní = info ke službě (zrušená lekce, zavřeno). Jde i klientům bez souhlasu s novinkami – kromě WhatsAppu.">
          <Select name="purpose" defaultValue={c?.purpose ?? "marketing"}>
            <option value="marketing">Novinky / marketing (jen se souhlasem)</option>
            <option value="service">Provozní informace</option>
          </Select>
        </Field>
        <Field label="Interní název"><Input name="name" defaultValue={c?.name} placeholder="např. Říjnový newsletter" required /></Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Komu">
          <Select name="segment" value={segment} onChange={(e) => setSegment(e.target.value)}>
            {segments.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </Field>
        {["inactive", "new", "class_type"].includes(segment) && (
          <Field label="Počet dní"><Input name="days" type="number" min={1} defaultValue={c?.audience.days ?? 30} /></Field>
        )}
        {segment === "class_type" && (
          <Field label="Typ lekce">
            <Select name="classTypeId" defaultValue={c?.audience.classTypeId}>
              {classTypes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </Field>
        )}
        {segment === "session" && (
          <Field label="Termín">
            <Select name="sessionId" defaultValue={c?.audience.sessionId}>
              {sessions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </Field>
        )}
      </div>

      {channel === "email" && (
        <Field label="Předmět"><Input name="subject" defaultValue={c?.subject ?? ""} placeholder="Ahoj {{jmeno}}, máme pro tebe novinku" /></Field>
      )}
      {channel !== "whatsapp" ? (
        <Field
          label={channel === "sms" ? "Text SMS" : "Text e-mailu"}
          hint={
            channel === "sms"
              ? `${sms.length} znaků · ${sms.parts} SMS na příjemce${sms.unicode ? " (s diakritikou se vejde jen 70 znaků – bez ní 160)" : ""}. U marketingové SMS se automaticky přidá odkaz na odhlášení.`
              : "Prázdný řádek = nový odstavec, **tučně**, „# Nadpis“ na začátku odstavce, odkazy se vytvoří samy."
          }
        >
          <Textarea name="body" rows={channel === "sms" ? 4 : 12} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
      ) : (
        <div className="grid gap-4 rounded-xl bg-krem/40 p-4 sm:grid-cols-3">
          <p className="text-sm text-les/70 sm:col-span-3">
            WhatsApp dovoluje firmám začít konverzaci jen <strong>schválenou šablonou</strong> (vytvoříš ji ve WhatsApp Manageru v Meta Business Suite). Sem napiš její název a hodnoty proměnných {"{{1}}, {{2}}"}…
          </p>
          <Field label="Název šablony"><Input name="waTemplate" defaultValue={c?.waTemplate ?? ""} placeholder="novinky_studio" /></Field>
          <Field label="Jazyk šablony"><Input name="waLanguage" defaultValue={c?.waLanguage ?? "cs"} /></Field>
          <Field label="Proměnné (každá na řádek)" hint="{{1}} = 1. řádek atd.">
            <Textarea name="waParams" rows={3} defaultValue={(c?.waParams ?? ["{{jmeno}}"]).join("\n")} />
          </Field>
          <input type="hidden" name="body" value="" />
        </div>
      )}
      <p className="text-xs text-les/60">
        Personalizace: <code>{"{{jmeno}}"}</code> křestní jméno · <code>{"{{cele_jmeno}}"}</code> · <code>{"{{kredit}}"}</code> zůstatek kreditu · <code>{"{{odhlasit}}"}</code> odkaz na odhlášení
      </p>
      <SubmitButton>{c ? "Uložit koncept" : "Vytvořit koncept"}</SubmitButton>
    </ActionForm>
  );
}
