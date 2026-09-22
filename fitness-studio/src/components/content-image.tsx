import Image, { type ImageProps } from "next/image";

/** next/image that also accepts external URLs pasted by the admin. */
export function ContentImage({ src, alt, ...props }: Omit<ImageProps, "src"> & { src: string }) {
  if (!src) return null;
  return <Image src={src} alt={alt} unoptimized={/^https?:\/\//.test(src)} {...props} />;
}
