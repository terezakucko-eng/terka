import "server-only";
import sharp, { type OutputInfo } from "sharp";
import type { Executor } from "@/db";
import { media } from "@/db/schema";
import { UserError } from "./errors";

export const MAX_UPLOAD = 12 * 1024 * 1024;

/** Resizes an upload to max 2400 px WebP and stores it; returns its public URL. */
export async function storeImage(db: Executor, file: File, maxWidth = 2400) {
  if (!file.type.startsWith("image/")) throw new UserError("Soubor není obrázek.");
  if (file.size > MAX_UPLOAD) throw new UserError("Obrázek je větší než 12 MB.");
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate() // respect phone EXIF orientation
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UserError("Obrázek se nepodařilo zpracovat (podporované: JPG, PNG, WebP).");
  }
  const [row] = await db
    .insert(media)
    .values({
      filename: file.name,
      mime: "image/webp",
      width: out.info.width,
      height: out.info.height,
      size: out.data.length,
      data: out.data,
    })
    .returning({ id: media.id });
  return `/media/${row.id}.webp`;
}

/** Returns the uploaded file from a form field, or null when none was chosen. */
export function uploadedFile(fd: FormData, name: string): File | null {
  const f = fd.get(name);
  return f instanceof File && f.size > 0 ? f : null;
}
