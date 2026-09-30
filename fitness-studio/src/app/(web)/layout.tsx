import { EditPageButton } from "@/components/edit-page-button";
import { AppOpenTracker } from "@/components/app-open-tracker";
import { InstallCatcher } from "@/components/install-catcher";
import { Popup } from "@/components/popup";
import { PromoBar } from "@/components/promo-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { getContent } from "@/content";
import { jsonLd, studioJsonLd } from "@/lib/seo";

export default async function WebLayout({ children }: LayoutProps<"/">) {
  const [user, c] = await Promise.all([getCurrentUser(), getContent()]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(studioJsonLd(c)) }} />
      <PromoBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <Popup />
      <InstallCatcher />
      {user?.role === "admin" && <EditPageButton />}
      {user && !user.appInstalledAt && <AppOpenTracker />}
    </>
  );
}
