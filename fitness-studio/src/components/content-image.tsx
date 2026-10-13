import Image, { type ImageProps } from "next/image";
import { aiImages } from "@/lib/ai-images";

/**
 * next/image that also accepts external URLs pasted by the admin. Pictures
 * marked as made with AI get a small label in the corner (the parent is
 * positioned – all uses fill their box).
 */
export async function ContentImage({ src, alt, ...props }: Omit<ImageProps, "src"> & { src: string }) {
  if (!src) return null;
  const ai = (await aiImages()).has(src);
  return (
    <>
      <Image src={src} alt={alt} unoptimized={/^https?:\/\//.test(src)} {...props} />
      {ai && (
        <span className="pointer-events-none absolute right-2 bottom-1.5 z-[1] text-[10px] font-medium tracking-wide text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
          Ilustrační foto · AI
        </span>
      )}
    </>
  );
}
