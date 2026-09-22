import Image from "next/image";
import { site } from "@/config/site";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image src="/img/pohyb.webp" alt="" fill sizes="50vw" className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-les/80 via-les/10 to-transparent" />
        <p className="absolute bottom-10 left-10 font-script text-6xl text-zlato-light">{site.claim}</p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
