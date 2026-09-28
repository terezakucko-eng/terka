import { Symbol, Wordmark } from "@/components/brand";
import { ContentImage } from "@/components/content-image";
import { getContent } from "@/content";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const c = await getContent();
  const claim = c("site.claim");
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <ContentImage src={c("auth.image")} alt="" fill sizes="50vw" className="object-cover" priority />
        {/* brand panel top-left, like the class images – keeps the photo's subject free */}
        <div className="absolute left-0 top-10 flex max-w-[85%] items-center gap-6 bg-mech/95 py-6 pl-8 pr-10 text-papir shadow-lg">
          <Symbol className="w-20 shrink-0" />
          <div className="min-w-0">
            <Wordmark className="w-56" />
            {claim && (
              <>
                <hr className="my-3 border-zlato/70" />
                <p className="max-w-sm text-sm font-semibold leading-relaxed text-papir/90">{claim}</p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
