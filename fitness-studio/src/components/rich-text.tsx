import { Fragment, type ReactNode } from "react";

/** Inline: **tučně** and bare links. React escapes everything else. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^https?:\/\//.test(part))
      return (
        <a key={i} href={part} className="underline underline-offset-4" target="_blank" rel="noreferrer">
          {part}
        </a>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Renders the admin's light markdown (## nadpis, - odrážka, odstavce). */
export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•]\s+/.test(l)))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ""))}</li>
              ))}
            </ul>
          );
        if (b.startsWith("## ") || b.startsWith("# ")) {
          const [head, ...rest] = lines;
          return (
            <Fragment key={i}>
              <h2>{inline(head.replace(/^#+\s+/, ""))}</h2>
              {rest.length > 0 && <RichText text={rest.join("\n")} />}
            </Fragment>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
