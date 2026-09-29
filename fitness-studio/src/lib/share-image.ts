/**
 * Browser: offers a generated image through the phone's share sheet (save to
 * photos, Instagram, …), or downloads it where sharing files isn't supported.
 * Returns "shared" | "downloaded"; throws AbortError when the user cancels.
 */
export async function shareOrDownload(src: string, fileName: string, share?: { title?: string; text?: string }) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const file = new File([blob], fileName, { type: blob.type || "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], ...share });
    return "shared" as const;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
  return "downloaded" as const;
}
