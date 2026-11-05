import { PassCardScan } from "@/components/pass-card-scan";

/** Every visit of a card's page counts as a scan in the studio's overview, whatever the page shows. */
export default async function PassCardLayout({ children, params }: LayoutProps<"/karticka/[code]">) {
  const { code } = await params;
  return (
    <>
      {children}
      <PassCardScan code={code} />
    </>
  );
}
