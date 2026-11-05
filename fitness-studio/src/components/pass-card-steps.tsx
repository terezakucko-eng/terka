import { site } from "@/config/site";
import { ShareButton } from "@/components/copy-button";
import { ButtonLink } from "@/components/ui";

/**
 * Right after signing up with a Pošli to dál card: two steps, nothing to read –
 * pick the free lesson, then send the card's second place to a friend.
 */
export function PassCardSteps({ code, friendPlace, center = false }: { code: string; friendPlace: boolean; center?: boolean }) {
  return (
    <>
      <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${center ? "sm:justify-center" : ""}`}>
        <ButtonLink href="/rozvrh" variant="gold">1. Vybrat lekci →</ButtonLink>
        {friendPlace && (
          <ShareButton
            url={`${site.url}/karticka/${code}`}
            text="Pojď se mnou do OCTOPUSH – máš tam lekci zdarma 🐙"
            label="2. Poslat lekci zdarma kamarádce"
            variant="outline-light"
          />
        )}
      </div>
      {friendPlace && <p className="mt-3 text-sm text-papir/70">Kamarádka klikne na odkaz, zaregistruje se a lekci má taky zdarma. Přijďte spolu!</p>}
    </>
  );
}
