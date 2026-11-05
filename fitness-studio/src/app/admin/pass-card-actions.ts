"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { addPassCard, chargePassCard, renewPassCard, resetPassCard, resetPassCardStats, setPassCardActive } from "@/domain/pass-cards";
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

/** Charge a card by hand (normally it charges itself once the second one signs up). */
export async function chargePassCardAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    await chargePassCard(await getDb(), field.str(fd, "id"));
    return "Kartička je nabitá 🔋 – zase má 2 místa.";
  });
  revalidatePath("/admin/karticky");
  return res;
}

/** An expired card back in the game – its month starts again at the next scan. */
export async function renewPassCardAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    await renewPassCard(await getDb(), field.str(fd, "id"));
    return "Kartička je zase ve hře – měsíc se začne počítat, až ji někdo naskenuje.";
  });
  revalidatePath("/admin/karticky");
  return res;
}

/** Reset a card by hand, whatever happened to it – in the game, both places, its month from the next scan. */
export async function resetPassCardAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    await resetPassCard(await getDb(), field.str(fd, "id"));
    return "Kartička je resetovaná 🔋 – je ve hře, má 2 místa a měsíc se začne počítat, až ji někdo naskenuje.";
  });
  revalidatePath("/admin/karticky");
  return res;
}

/** Přehled: the Pošli to dál numbers start again from now (the cards and their chains stay). */
export async function resetPassCardStatsAction(): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    await resetPassCardStats(await getDb());
    return "Vynulováno – počítá se od teď.";
  });
  revalidatePath("/admin");
  revalidatePath("/admin/karticky");
  return res;
}
