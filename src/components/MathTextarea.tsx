import { useRef, useState } from "react";
import { Sigma } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { MathKeypad } from "@/components/MathKeypad";
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

/** Textarea with a built-in scientific calculator keypad that types LaTeX for you. */
export function MathTextarea({
  value,
  onValueChange,
  placeholder,
  className,
  readOnly,
  disabled,
  wrapperClassName,
  keypadLabel = "Math keypad",
  onKeyDown,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [open, setOpen] = useState(false);

  const insert = (snippet: string) => {
    const el = ref.current;
    const caretMarker = snippet.indexOf("@");
    const body = snippet.replace("@", "");
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;

    // Wrap in $…$ unless the caret already sits inside math delimiters.
    const before = value.slice(0, start);
    const dollars = (before.match(/\$/g) ?? []).length;
    const insideMath = dollars % 2 === 1;
    const text = insideMath ? body : `$${body}$`;
    const next = `${before}${text}${value.slice(end)}`;
    onValueChange(next);

    const offset = insideMath ? 0 : 1;
    const caret = caretMarker >= 0 ? start + offset + caretMarker : start + offset + body.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className={cn("w-full", wrapperClassName)}>
      <Textarea
        ref={ref}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {!readOnly && !disabled && (
        <>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-gold/60 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-gold/20"
          >
            <Sigma className="h-3.5 w-3.5" />
            {open ? "Hide math keypad" : keypadLabel}
          </button>
          {open && (
            <MathKeypad onInsert={insert} preview={value} onClose={() => setOpen(false)} />
          )}
        </>
      )}
    </div>
  );
}
