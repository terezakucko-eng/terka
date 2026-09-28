"use client";

import { useRef, useState } from "react";
import { editCommentAction } from "@/app/actions/board";
import { COMMENT_EMOJI, MAX_COMMENT } from "@/lib/board";
import type { FormState } from "@/lib/form";
import { nbsp } from "@/lib/typography";
import { ActionForm, SubmitButton } from "./forms";
import { Textarea } from "./ui";

/** Comment textarea with a row of emoji that insert at the cursor. */
export function CommentBox({ defaultValue = "", autoFocus }: { defaultValue?: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (e: string) => {
    const t = ref.current;
    if (!t) return;
    const start = t.selectionStart ?? t.value.length;
    const end = t.selectionEnd ?? start;
    t.setRangeText(e, start, end, "end");
    t.focus();
  };
  return (
    <div className="space-y-1.5">
      <Textarea
        ref={ref}
        name="body"
        rows={2}
        maxLength={MAX_COMMENT}
        defaultValue={defaultValue}
        placeholder="Napiš reakci…"
        aria-label="Reakce"
        autoFocus={autoFocus}
        required
      />
      <div className="flex flex-wrap gap-0.5" aria-label="Vložit emoji">
        {COMMENT_EMOJI.map((e) => (
          <button key={e} type="button" onClick={() => insert(e)} className="rounded-md px-1.5 py-0.5 text-lg leading-none hover:bg-krem" aria-label={`Vložit ${e}`}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Comment text; its author (or an admin) can switch it to an edit form. */
export function EditableComment({ id, body, canEdit, edited }: { id: string; body: string; canEdit: boolean; edited: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <ActionForm
        action={async (prev: FormState, fd: FormData) => {
          const r = await editCommentAction(prev, fd);
          if (r?.ok) setEditing(false);
          return r;
        }}
        className="mt-2 space-y-2"
      >
        <input type="hidden" name="id" value={id} />
        <CommentBox defaultValue={body} autoFocus />
        <div className="flex items-center gap-3">
          <SubmitButton variant="outline" className="px-4 py-2 text-[0.7rem]">Uložit</SubmitButton>
          <button type="button" onClick={() => setEditing(false)} className="text-xs underline">Zrušit</button>
        </div>
      </ActionForm>
    );
  return (
    <p className="mt-1 whitespace-pre-line">
      {nbsp(body)}
      {edited && <span className="ml-1 text-xs text-les/40">(upraveno)</span>}
      {canEdit && (
        <button type="button" onClick={() => setEditing(true)} className="ml-2 text-xs text-les/60 underline">
          Upravit
        </button>
      )}
    </p>
  );
}
