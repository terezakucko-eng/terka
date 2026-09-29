/** Phones and tablets – a computer should simply download the file. */
const isMobile = () =>
  /iPhone|iPad|iPod|Android/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/**
 * Browser: offers a generated image through the phone's share sheet (save to
 * photos, Instagram, …); computers (Windows / Mac also have a share sheet,
 * but no "save" in it) and browsers without file sharing get a download.
 * Returns "shared" | "downloaded"; throws AbortError when the user cancels.
 */
export async function shareOrDownload(src: string, fileName: string, share?: { title?: string; text?: string }) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const file = new File([blob], fileName, { type: blob.type || "image/png" });
  if (isMobile() && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], ...share });
    return "shared" as const;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // give the browser a moment to start the download before freeing the file
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return "downloaded" as const;
}
