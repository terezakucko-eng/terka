"use client";

import { useState } from "react";
import { cx } from "./ui";

const MAX_SIDE = 2000;
const QUALITIES = [0.85, 0.75, 0.65, 0.55];
const TARGET = 1024 * 1024;

/**
 * Photo picker that shrinks the image in the browser before the form is sent,
 * so several phone photos fit into one save (hosting caps a request at ~4.5 MB).
 * The server still converts the upload to WebP.
 */
export function ImageInput({ name, className }: { name: string; className?: string }) {
  const [status, setStatus] = useState<{ preview: string; note: string } | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return setStatus(null);
    setStatus({ preview: "", note: "Zmenšuji fotku…" });
    try {
      const small = await shrink(file);
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files;
      setStatus({ preview: URL.createObjectURL(small), note: `Připraveno (${mb(small.size)}) – nezapomeň uložit.` });
    } catch {
      // Browser can't decode it (e.g. HEIC outside Safari) – send the original, the server tries.
      setStatus({ preview: "", note: `Fotku se nepodařilo zmenšit v prohlížeči (${mb(file.size)}).` });
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="file"
        name={name}
        accept="image/*"
        onChange={onChange}
        className={cx(
          "block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-les file:px-4 file:py-2 file:text-xs file:font-semibold file:text-papir",
          className,
        )}
      />
      {status && (
        <div className="flex items-center gap-3 text-xs text-les/70">
          {status.preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={status.preview} alt="" className="h-12 w-16 rounded object-cover" />
          )}
          <span>{status.note}</span>
        </div>
      )}
    </div>
  );
}

async function shrink(file: File): Promise<File> {
  // Small PNG/GIF (logos, graphics with transparency) go as they are – JPEG would lose transparency.
  if (/image\/(png|gif)/.test(file.type) && file.size < 1.5 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Lower the quality step by step until the photo is around 1 MB.
  let blob: Blob | null = null;
  for (const q of QUALITIES) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (!blob) throw new Error("encode failed");
    if (blob.size <= TARGET) break;
  }
  if (!blob) throw new Error("encode failed");
  // Keep the original when it is already smaller (e.g. a small PNG logo).
  if (blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
