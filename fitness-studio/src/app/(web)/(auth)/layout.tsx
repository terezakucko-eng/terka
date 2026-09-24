import { ContentImage } from "@/components/content-image";
import { getContent } from "@/content";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const c = await getContent();
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <ContentImage src={c("auth.image")} alt="" fill sizes="50vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-les/80 via-les/10 to-transparent" />
        <p className="absolute bottom-10 left-10 font-script text-6xl text-zlato-light">{c("site.claim")}</p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
