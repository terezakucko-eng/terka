"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";

/**
 * A short explainer that starts by itself – with sound where the browser lets it, else muted (phones never allow
 * sound before a tap), so the captions are part of the picture and one tap plays it again with sound.
 * No autoplay for those who ask for less motion or save data.
 */
export function AutoplayVideo({ src, poster, label }: { src: string; poster?: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (calm || saveData) return;
    v.muted = false;
    v.play()
      .then(() => setMuted(false))
      .catch(() => {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {});
      });
  }, []);

  const sound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
    if (v.paused) v.play().catch(() => {});
  };
  // the first tap: from the start, with sound
  const withSound = () => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    setMuted(false);
    setEnded(false);
    v.play().catch(() => {});
  };
  const again = () => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    setEnded(false);
    v.play().catch(() => {});
  };

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[min(100%,calc(62svh*9/16))] overflow-hidden rounded-3xl border border-zlato/30 bg-les shadow-2xl">
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        playsInline
        preload="metadata"
        aria-label={label}
        className="h-full w-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setEnded(true)}
        onClick={() => {
          const v = ref.current;
          if (!v) return;
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }}
      />
      {muted && playing && !ended && (
        <button
          type="button"
          onClick={withSound}
          className="absolute left-1/2 top-[16%] flex -translate-x-1/2 animate-pulse items-center gap-2 whitespace-nowrap rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-les shadow-xl"
        >
          <Volume2 className="size-5" /> Klepni pro zvuk
        </button>
      )}
      {ended ? (
        <button type="button" onClick={again} className="absolute inset-0 grid place-items-center bg-les/50 text-papir">
          <span className="flex items-center gap-2 rounded-full bg-gold px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-les">
            <RotateCcw className="size-4" /> Přehrát znovu
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={sound}
          className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-les/75 px-4 py-2.5 text-xs font-semibold text-papir backdrop-blur"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          {muted ? (playing ? "Zapnout zvuk" : "Přehrát se zvukem") : "Vypnout zvuk"}
        </button>
      )}
    </div>
  );
}
