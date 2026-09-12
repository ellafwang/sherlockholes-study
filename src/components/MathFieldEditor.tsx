import { useEffect, useRef } from "react";

/**
 * A Desmos-style visual math editor. Whatever you type or tap shows up as real
 * symbols; the LaTeX behind it never has to be seen.
 */
export type MathFieldHandle = {
  insert: (latex: string) => void;
  getValue: () => string;
  clear: () => void;
  focus: () => void;
};

export function MathFieldEditor({
  onReady,
  onChange,
  onEnter,
  className,
}: {
  onReady?: (handle: MathFieldHandle) => void;
  onChange?: (latex: string) => void;
  onEnter?: () => void;
  className?: string;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const onReadyRef = useRef(onReady);
  const onChangeRef = useRef(onChange);
  const onEnterRef = useRef(onEnter);
  onReadyRef.current = onReady;
  onChangeRef.current = onChange;
  onEnterRef.current = onEnter;

  useEffect(() => {
    let field: HTMLElement & {
      value: string;
      executeCommand: (command: unknown) => void;
      focus: () => void;
      mathVirtualKeyboardPolicy?: string;
      smartMode?: boolean;
    };
    let cancelled = false;

    void (async () => {
      await import("mathlive");
      if (cancelled || !host.current) return;
      field = document.createElement("math-field") as typeof field;
      field.setAttribute("style", "width:100%;font-size:1.25rem;padding:0.5rem 0.65rem;border-radius:0.5rem;");
      field.mathVirtualKeyboardPolicy = "manual";
      field.smartMode = true;
      field.addEventListener("input", () => onChangeRef.current?.(field.value));
      field.addEventListener("keydown", (event) => {
        const key = (event as KeyboardEvent).key;
        if (key === "Enter") {
          event.preventDefault();
          onEnterRef.current?.();
        }
      });
      host.current.replaceChildren(field);
      onReadyRef.current?.({
        insert: (latex) => {
          field.executeCommand(["insert", latex, { focus: true, feedback: false }]);
        },
        getValue: () => field.value,
        clear: () => {
          field.value = "";
          onChangeRef.current?.("");
        },
        focus: () => field.focus(),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      ref={host}
      className={className}
      // math-field styles itself; this wrapper just supplies the frame
    />
  );
}
