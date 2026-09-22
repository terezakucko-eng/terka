import { Symbol } from "@/components/brand";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="bg-forest flex min-h-screen flex-col items-center justify-center px-4 text-center text-papir">
      <Symbol className="w-40" />
      <p className="eyebrow mt-10 text-zlato">404</p>
      <h1 className="mt-3 text-3xl font-medium">Tahle cesta nikam nevede.</h1>
      <ButtonLink href="/" variant="gold" className="mt-8">Zpět na úvod</ButtonLink>
    </main>
  );
}
