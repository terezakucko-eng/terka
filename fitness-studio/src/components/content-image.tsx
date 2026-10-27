import Image, { type ImageProps } from "next/image";
import { aiImages } from "@/lib/ai-images";
import { cx } from "./ui";

/**
 * The watermark on a picture made with AI: the octopus with "AI" in its head,
 * in the corner (the parent is positioned).
 */
export function AiMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/symbol-ai.svg"
      alt="Ilustrační foto vytvořené pomocí AI"
      width={340}
      height={290}
      className={cx("pointer-events-none absolute right-2 bottom-2 z-[1] h-auto w-16 opacity-95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)] sm:w-20", className)}
    />
  );
}

/**
 * next/image that also accepts external URLs pasted by the admin. Pictures
 * marked as made with AI get the AI watermark in the corner (all uses fill
 * their box).
 */
export async function ContentImage({ src, alt, ...props }: Omit<ImageProps, "src"> & { src: string }) {
  if (!src) return null;
  const ai = (await aiImages()).has(src);
  return (
    <>
      <Image src={src} alt={alt} unoptimized={/^https?:\/\//.test(src)} {...props} />
      {ai && <AiMark />}
    </>
  );
}
