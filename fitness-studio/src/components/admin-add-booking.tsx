"use client";

import { useEffect, useState } from "react";
import { adminAddBookingAction, adminBookingOptionsAction } from "@/app/admin/actions";
import type { BookingOption } from "@/domain/booking";
import type { ClientOpt } from "./client-picker";
import { ClientSelect } from "./client-select";
import { ActionForm, SubmitButton } from "./forms";
import { Field, Input, Select } from "./ui";

/**
 * Reception adds a client to a class: picks what to charge (the client's own
 * passes, free entries, membership or credit – or nothing) and can bring a friend.
 */
export function AdminAddBooking({
  sessionId,
  clients,
  friendAllowed,
}: {
  sessionId: string;
  clients: ClientOpt[];
  friendAllowed: boolean;
}) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [friend, setFriend] = useState("");
  const [opts, setOpts] = useState<BookingOption[] | null>(null);
  const withFriend = friend.trim() !== "";

  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    adminBookingOptionsAction(sessionId, clientId, withFriend).then((o) => alive && setOpts(o));
    return () => {
      alive = false;
    };
  }, [sessionId, clientId, withFriend]);

  const usable = (opts ?? []).filter((o) => !o.disabled);
  const shown = clientId ? opts : null;

  return (
    <ActionForm action={adminAddBookingAction} className="mt-4 space-y-3" resetOnSuccess>
      <input type="hidden" name="sessionId" value={sessionId} />
      {/* not a <Field>: a wrapping <label> would click the "remove" button right after picking */}
      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-les/70">Klient</span>
        <ClientSelect
          name="client"
          clients={clients}
          onPick={(id) => {
            setOpts(null);
            setClientId(id);
            if (!id) setFriend("");
          }}
        />
      </div>
      {friendAllowed && (
        <Field label="Kamarádka (+1)" hint="Jméno, když přijde s někým. Strhne se za dvě místa.">
          <Input name="guestName" value={friend} onChange={(e) => setFriend(e.target.value)} placeholder="např. Petra" maxLength={80} />
        </Field>
      )}
      <Field label="Platba">
        <Select name="pay" key={`${clientId}-${withFriend}-${usable[0]?.entitlementId ?? usable[0]?.method ?? ""}`} defaultValue={usable[0] ? value(usable[0]) : "auto"}>
          {shown === null ? (
            <option value="auto">Strhnout automaticky (členství / permanentka / vstup zdarma / kredit)</option>
          ) : (
            shown.map((o) => (
              <option key={value(o)} value={value(o)} disabled={!!o.disabled}>
                {o.label} – {o.disabled ?? o.detail}
              </option>
            ))
          )}
          <option value="admin">Bez strhnutí (zaplaceno na místě / host)</option>
        </Select>
      </Field>
      {shown !== null && usable.length === 0 && (
        <p className="text-xs text-chyba">Klient nemá čím zaplatit{withFriend ? " za dva" : ""} – můžeš ho přidat bez strhnutí.</p>
      )}
      <SubmitButton className="w-full">Přidat na lekci</SubmitButton>
    </ActionForm>
  );
}

const value = (o: BookingOption) => `${o.method}:${o.entitlementId ?? ""}`;
