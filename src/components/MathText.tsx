import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment, useMemo } from "react";

/** Splits text into plain and math parts, supporting $…$, $$…$$, \(…\) and \[…\]. */
const MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;

type Part =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string; display: boolean };

export function splitMath(input: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const match of input.matchAll(MATH_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "text", value: input.slice(last, index) });
    const display = match[1] ?? match[2];
    const inline = match[3] ?? match[4];
    parts.push({ kind: "math", value: (display ?? inline ?? "").trim(), display: display != null });
    last = index + match[0].length;
  }
  if (last < input.length) parts.push({ kind: "text", value: input.slice(last) });
  return parts;
}

/** Renders a string that may contain LaTeX, so equations show as real math. */
export function MathText({ children, className }: { children: string; className?: string }) {
  const parts = useMemo(() => splitMath(children ?? ""), [children]);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.kind === "text") return <Fragment key={index}>{part.value}</Fragment>;
        let html: string;
        try {
          html = katex.renderToString(part.value, {
            displayMode: part.display,
            throwOnError: false,
            output: "html",
            strict: "ignore",
          });
        } catch {
          return <Fragment key={index}>{part.value}</Fragment>;
        }
        return (
          <span
            key={index}
            className={part.display ? "my-2 block overflow-x-auto" : ""}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}
