import type { Metadata } from "next";
import { LegalPage } from "@/components/prose";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Obchodní podmínky" };

export default async function TermsPage() {
  const cfg = await getSettings(await getDb());
  return (
    <LegalPage title="Obchodní podmínky">
      <h2>1. Provozovatel</h2>
      <p>{site.company.name}, IČO {site.company.ico}, {site.address.street}, {site.address.zip} {site.address.city}, e-mail {site.email}.</p>
      <h2>2. Rezervace lekcí</h2>
      <ul>
        <li>Rezervace probíhá online přes klientský účet, nejdříve {cfg.bookingWindowDays} dní před lekcí.</li>
        <li>Lekci lze zaplatit kreditem, permanentkou, členstvím, vstupem zdarma nebo jednorázově platební kartou.</li>
        <li>Neuhrazená rezervace jednorázového vstupu se uvolní po {cfg.pendingPaymentMinutes} minutách.</li>
      </ul>
      <h2>3. Storno podmínky</h2>
      <ul>
        <li>Rezervaci lze bezplatně zrušit nejpozději {cfg.cancellationHours} hodin před začátkem lekce; vstup nebo kredit se vrací na účet.</li>
        <li>Při pozdějším zrušení nebo neúčasti vstup propadá.</li>
        <li>Zruší-li lekci studio, vstup se vrací vždy. Jednorázový vstup zaplacený kartou je vrácen ve formě kreditu.</li>
        <li>Při uvolnění místa je automaticky přihlášen klient z pořadníku a je mu stržen vstup.</li>
      </ul>
      <h2>4. Kredit, permanentky a členství</h2>
      <ul>
        <li>Kredit je nepřenosný a nepropadá. 1 kredit odpovídá ceně uvedené u lekce.</li>
        <li>Permanentky platí po dobu uvedenou v ceníku od data nákupu.</li>
        <li>Členství se automaticky obnovuje každý měsíc platbou kartou. Obnovení lze kdykoliv zrušit v účtu; členství pak platí do konce zaplaceného období.</li>
      </ul>
      <h2>5. Platby</h2>
      <p>Online platby zpracovává Stripe Payments Europe, Ltd. Ceny jsou uvedeny v Kč včetně DPH (je-li provozovatel plátcem).</p>
      <h2>6. Odstoupení od smlouvy</h2>
      <p>Spotřebitel bere na vědomí, že dle § 1837 písm. j) občanského zákoníku nelze odstoupit od smlouvy o využití volného času, je-li plněno v určeném termínu. U permanentek a kreditu lze odstoupit do 14 dnů od nákupu, pokud nebyly čerpány.</p>
      <h2>7. Zdraví a bezpečnost</h2>
      <p>Klient cvičí na vlastní odpovědnost a je povinen upozornit lektora na zdravotní omezení.</p>
    </LegalPage>
  );
}
