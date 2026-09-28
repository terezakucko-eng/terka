import { Play } from "lucide-react";
import { videoEmbedUrl } from "@/lib/video";
import { cx } from "./ui";

/** Collapsed "Videoukázka" – the player loads only after it's opened. */
export function VideoEmbed({ url, title, className }: { url: string | null | undefined; title: string; className?: string }) {
  const src = videoEmbedUrl(url);
  if (!src) return null;
  return (
    <details className={cx("group", className)}>
      <summary className="eyebrow inline-flex cursor-pointer list-none items-center gap-2 text-zeme [&::-webkit-details-marker]:hidden">
        <Play className="size-4" /> <span className="group-open:hidden">Videoukázka</span><span className="hidden group-open:inline">Skrýt video</span>
      </summary>
      <div className="relative mt-4 aspect-video overflow-hidden rounded-xl bg-les">
        <iframe
          src={src}
          title={`Videoukázka – ${title}`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      </div>
    </details>
  );
}
