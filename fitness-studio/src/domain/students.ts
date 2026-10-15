import "server-only";
import sharp from "sharp";
import { eq, desc } from "drizzle-orm";
import type { Executor } from "@/db";
import { studentProofs, users } from "@/db/schema";
import { UserError } from "@/lib/errors";
import { MAX_UPLOAD } from "@/lib/media";

/** Stores (or replaces) the client's ISIC / confirmation photo – shrunk, EXIF dropped. */
export async function saveStudentProof(db: Executor, userId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new UserError("Nahraj prosím fotku (JPG, PNG nebo WebP).");
  if (file.size > MAX_UPLOAD) throw new UserError("Fotka je větší než 12 MB.");
  let data: Buffer;
  try {
    data = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new UserError("Fotku se nepodařilo zpracovat (podporované: JPG, PNG, WebP).");
  }
  await db
    .insert(studentProofs)
    .values({ userId, data, size: data.length })
    .onConflictDoUpdate({ target: studentProofs.userId, set: { data, size: data.length, createdAt: new Date() } });
}

export const deleteStudentProof = (db: Executor, userId: string) => db.delete(studentProofs).where(eq(studentProofs.userId, userId));

export async function studentProofOf(db: Executor, userId: string) {
  const [p] = await db.select().from(studentProofs).where(eq(studentProofs.userId, userId));
  return p ?? null;
}

/** Whether the client has a photo waiting (without loading it). */
export async function hasStudentProof(db: Executor, userId: string) {
  const [p] = await db.select({ at: studentProofs.createdAt }).from(studentProofs).where(eq(studentProofs.userId, userId));
  return p?.at ?? null;
}

/** Photos waiting for the reception (Přehled). */
export const pendingStudentProofs = (db: Executor) =>
  db
    .select({ id: users.id, name: users.name, at: studentProofs.createdAt })
    .from(studentProofs)
    .innerJoin(users, eq(users.id, studentProofs.userId))
    .orderBy(desc(studentProofs.createdAt));
