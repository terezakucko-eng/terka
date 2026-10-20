"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { addPassCard, chargePassCard, setPassCardActive } from "@/domain/pass-cards";
import { requireAdmin } from "@/lib/auth";
import { attempt, field, type FormState } from "@/lib/form";

/** Admin → Pošli to dál: one more card into the game. */
export async function addPassCardAction(): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    const card = await addPassCard(await getDb());
    return `${card.label} je připravená – stáhni si ji k tisku.`;
  });
  revalidatePath("/admin/karticky");
  return res;
}

/** A lost card out of the game (or back in). */
export async function togglePassCardAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const active = field.str(fd, "active") === "1";
  const res = await attempt(async () => {
    await setPassCardActive(await getDb(), field.str(fd, "id"), active);
    return active ? "Kartička je zase ve hře." : "Kartička je mimo hru – registrace přes ni už lekce navíc nedá.";
  });
  revalidatePath("/admin/karticky");
  return res;
}

/** Charge a card by hand (normally it charges itself after the lesson). */
export async function chargePassCardAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    await chargePassCard(await getDb(), field.str(fd, "id"));
    return "Kartička je nabitá 🔋 – další člověk s ní dostane lekci pro dva.";
  });
  revalidatePath("/admin/karticky");
  return res;
}
