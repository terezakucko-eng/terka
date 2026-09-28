import { EditPageButton } from "@/components/edit-page-button";
import { Popup } from "@/components/popup";
import { PromoBar } from "@/components/promo-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

export default async function WebLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <>
      <PromoBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <Popup />
      {user?.role === "admin" && <EditPageButton />}
    </>
  );
}
