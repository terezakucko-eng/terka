"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Redo2,
  TextQuote,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { cx } from "./ui";

/**
 * Word-like editor for longer website texts. Keeps the HTML in a hidden
 * input named `name`, so it works inside ordinary server-action forms.
 */
export function RichEditor({ name, defaultValue, minHeight = 260 }: { name: string; defaultValue: string; minHeight?: number }) {
  const [html, setHtml] = useState(defaultValue);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class: "rich min-h-[var(--min-h)] px-4 py-3 text-[15px] leading-relaxed text-les/85 outline-none",
      },
    },
    onUpdate: ({ editor }) => setHtml(editor.isEmpty ? "" : editor.getHTML()),
  });

  // Form reset (e.g. after saving a new post) also clears the editor.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form || !editor) return;
    const onReset = () => {
      editor.commands.setContent(defaultValue);
      setHtml(defaultValue);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [editor, defaultValue]);

  return (
    <div
      ref={box}
      className="overflow-hidden rounded-xl border border-linka bg-white/80 focus-within:border-les"
      style={{ "--min-h": `${minHeight}px` } as React.CSSProperties}
    >
      <input type="hidden" name={name} value={html} />
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b border-linka/60 bg-krem/40" />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      p: e.isActive("paragraph"),
      ul: e.isActive("bulletList"),
      ol: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      undo: e.can().undo(),
      redo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Adresa odkazu (např. https://instagram.com/…)", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "" || url.trim() === "https://") chain().extendMarkRange("link").unsetLink().run();
    else chain().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-linka/60 bg-krem/40 px-2 py-1.5">
      <Btn label="Odstavec" active={s.p && !s.ul && !s.ol && !s.quote} onClick={() => chain().setParagraph().run()}><Pilcrow /></Btn>
      <Btn label="Nadpis" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 /></Btn>
      <Btn label="Podnadpis" active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 /></Btn>
      <Sep />
      <Btn label="Tučně (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()}><Bold /></Btn>
      <Btn label="Kurzíva (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()}><Italic /></Btn>
      <Btn label="Podtržení (Ctrl+U)" active={s.underline} onClick={() => chain().toggleUnderline().run()}><Underline /></Btn>
      <Sep />
      <Btn label="Odrážky" active={s.ul} onClick={() => chain().toggleBulletList().run()}><List /></Btn>
      <Btn label="Číslovaný seznam" active={s.ol} onClick={() => chain().toggleOrderedList().run()}><ListOrdered /></Btn>
      <Btn label="Citace" active={s.quote} onClick={() => chain().toggleBlockquote().run()}><TextQuote /></Btn>
      <Btn label="Oddělovač" onClick={() => chain().setHorizontalRule().run()}><Minus /></Btn>
      <Sep />
      <Btn label="Odkaz" active={s.link} onClick={setLink}><LinkIcon /></Btn>
      {s.link && <Btn label="Zrušit odkaz" onClick={() => chain().extendMarkRange("link").unsetLink().run()}><Unlink /></Btn>}
      <Sep />
      <Btn label="Zpět (Ctrl+Z)" disabled={!s.undo} onClick={() => chain().undo().run()}><Undo2 /></Btn>
      <Btn label="Znovu" disabled={!s.redo} onClick={() => chain().redo().run()}><Redo2 /></Btn>
    </div>
  );
}

function Btn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        "grid size-8 place-items-center rounded-md text-les/70 transition hover:bg-les/10 hover:text-les disabled:opacity-30 [&_svg]:size-4",
        active && "bg-les text-papir hover:bg-les hover:text-papir",
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-linka" />;
