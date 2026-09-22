import type { Metadata } from "next";
import { LegalPage } from "@/components/prose";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Ochrana osobních údajů" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Ochrana osobních údajů">
      <h2>Správce</h2>
      <p>{site.company.name}, IČO {site.company.ico}, kontakt {site.email}.</p>
      <h2>Jaké údaje zpracováváme a proč</h2>
      <ul>
        <li>Jméno, e-mail, telefon – vedení klientského účtu a rezervací (plnění smlouvy).</li>
        <li>Historie rezervací a plateb – plnění smlouvy a zákonné účetní povinnosti.</li>
        <li>E-mail pro novinky – pouze se souhlasem, který lze kdykoliv odvolat v profilu.</li>
      </ul>
      <h2>Příjemci</h2>
      <p>Poskytovatel hostingu a databáze, platební brána Stripe, služba pro odesílání e-mailů. Údaje neprodáváme.</p>
      <h2>Doba uložení</h2>
      <p>Po dobu trvání účtu, účetní doklady po dobu stanovenou zákonem.</p>
      <h2>Cookies</h2>
      <p>Web používá pouze technicky nezbytnou cookie pro přihlášení. Analytické ani marketingové cookies nepoužíváme.</p>
      <h2>Vaše práva</h2>
      <p>Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost a vznesení námitky, a právo podat stížnost u ÚOOÚ. Žádosti posílejte na {site.email}.</p>
    </LegalPage>
  );
}
