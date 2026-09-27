import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ProductCard } from "@/components/product-card";
import { Container, Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Nabídka", robots: { index: false } };

const UUID = /^[0-9a-f-]{36}$/i;

/** Direct link to one product – also works for link-only offers hidden from the price list. */
export default async function ProductLinkPage({ params }: PageProps<"/cenik/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [p] = await (await getDb()).select().from(products).where(and(eq(products.id, id), eq(products.isActive, true)));
  if (!p) notFound();
  const user = await getCurrentUser();
  return (
    <Container className="max-w-md py-14">
      <Eyebrow className="text-zeme">{p.linkOnly ? "Nabídka jen pro tebe" : "Ceník"}</Eyebrow>
      <div className="mt-6">
        <ProductCard p={p} loggedIn={!!user} next={`/cenik/${p.id}`} />
      </div>
      <Link href="/cenik" className="eyebrow mt-8 inline-block text-zeme underline underline-offset-4">Celý ceník</Link>
    </Container>
  );
}
