import { useRef, useState } from "react";
import { Sigma } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { MathKeypad } from "@/components/MathKeypad";
import { MathFieldEditor, type MathFieldHandle } from "@/components/MathFieldEditor";
import { MathText } from "@/components/MathText";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  disabled?: boolean;
  wrapperClassName?: string;
  keypadLabel?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

const hasMath = (text: string) => /\$[^$]+\$|\\[a-zA-Z]+/.test(text);

/**
 * Textarea for words, plus a visual equation builder for anything mathematical.
 * The equation looks like real symbols while you build it, Desmos style.
 */
export function MathTextarea({
  value,
  onValueChange,
  placeholder,
  className,
  readOnly,
  disabled,
  wrapperClassName,
  keypadLabel = "Add an equation",
  onKeyDown,
}: Props) {
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const field = useRef<MathFieldHandle | null>(null);
  const caret = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [draftLatex, setDraftLatex] = useState("");

  const addEquation = () => {
    const latex = (field.current?.getValue() ?? "").trim();
    if (!latex) return;
    const at = caret.current ?? value.length;
    const before = value.slice(0, at);
    const after = value.slice(at);
    const spacer = before && !/\s$/.test(before) ? " " : "";
    const next = `${before}${spacer}$${latex}$ ${after}`;
    onValueChange(next);
    caret.current = next.length - after.length;
    field.current?.clear();
    setDraftLatex("");
    field.current?.focus();
  };

  return (
    <div className={cn("w-full", wrapperClassName)}>
      <Textarea
        ref={textarea}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        onChange={(event) => onValueChange(event.target.value)}
        onSelect={(event) => {
          caret.current = (event.target as HTMLTextAreaElement).selectionStart;
        }}
        onKeyDown={onKeyDown}
      />

      {hasMath(value) && !readOnly && (
        <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <p className="label-caps text-muted-foreground">How it reads</p>
          <div className="mt-1 max-h-32 overflow-auto text-base leading-relaxed">
            <MathText>{value}</MathText>
          </div>
        </div>
      )}

      {!readOnly && !disabled && (
        <>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gold/60 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-gold/20"
          >
            <Sigma className="h-3.5 w-3.5" />
            {open ? "Hide equation builder" : keypadLabel}
          </button>

          {open && (
            <div className="mt-2 rounded-xl border border-gold/50 bg-card/95 p-3 shadow-lg">
              <p className="label-caps text-muted-foreground">
                Build it here — it shows as real math
              </p>
              <div className="mt-1 rounded-lg border border-border bg-background">
                <MathFieldEditor
                  onReady={(handle) => {
                    field.current = handle;
                  }}
                  onChange={setDraftLatex}
                  onEnter={addEquation}
                />
              </div>
              <div className="mt-2">
                <MathKeypad onInsert={(snippet) => field.current?.insert(snippet)} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={addEquation}
                  disabled={!draftLatex.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Add to my text
                </button>
                <button
                  type="button"
                  onClick={() => {
                    field.current?.clear();
                    setDraftLatex("");
                  }}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ml-auto text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
