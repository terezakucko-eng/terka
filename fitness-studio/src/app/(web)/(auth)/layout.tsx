import { ContentImage } from "@/components/content-image";
import { getContent } from "@/content";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const c = await getContent();
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <ContentImage src={c("auth.image")} alt="" fill sizes="50vw" className="object-cover" priority />
        <p className="absolute inset-x-10 bottom-10 max-w-lg bg-les/95 p-6 text-lg font-semibold leading-relaxed text-papir empty:hidden">
          {c("site.claim")}
        </p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
