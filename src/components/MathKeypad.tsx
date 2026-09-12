import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A scientific-calculator style keypad. Each key inserts LaTeX into the visual
 * math editor, where it appears as a real symbol — `#?` marks a blank slot.
 */
type Key = { label: string; snippet: string; wide?: boolean };

const GROUPS: { name: string; keys: Key[] }[] = [
  {
    name: "Numbers",
    keys: [
      { label: "7", snippet: "7" },
      { label: "8", snippet: "8" },
      { label: "9", snippet: "9" },
      { label: "÷", snippet: "\\div" },
      { label: "×", snippet: "\\times" },
      { label: "4", snippet: "4" },
      { label: "5", snippet: "5" },
      { label: "6", snippet: "6" },
      { label: "+", snippet: "+" },
      { label: "−", snippet: "-" },
      { label: "1", snippet: "1" },
      { label: "2", snippet: "2" },
      { label: "3", snippet: "3" },
      { label: "( )", snippet: "\\left(#?\\right)" },
      { label: "±", snippet: "\\pm" },
      { label: "0", snippet: "0" },
      { label: ".", snippet: "." },
      { label: "π", snippet: "\\pi" },
      { label: "e", snippet: "e" },
      { label: "%", snippet: "\\%" },
    ],
  },
  {
    name: "Powers & roots",
    keys: [
      { label: "x²", snippet: "#@^{2}" },
      { label: "xⁿ", snippet: "#@^{#?}" },
      { label: "xₙ", snippet: "#@_{#?}" },
      { label: "√", snippet: "\\sqrt{#?}" },
      { label: "ⁿ√", snippet: "\\sqrt[#?]{#?}" },
      { label: "a⁄b", snippet: "\\frac{#?}{#?}" },
      { label: "|x|", snippet: "\\left|#?\\right|" },
      { label: "eˣ", snippet: "e^{#?}" },
      { label: "10ˣ", snippet: "10^{#?}" },
      { label: "×10ⁿ", snippet: "\\times10^{#?}" },
    ],
  },
  {
    name: "Functions",
    keys: [
      { label: "sin", snippet: "\\sin(#?)" },
      { label: "cos", snippet: "\\cos(#?)" },
      { label: "tan", snippet: "\\tan(#?)" },
      { label: "sin⁻¹", snippet: "\\sin^{-1}(#?)" },
      { label: "cos⁻¹", snippet: "\\cos^{-1}(#?)" },
      { label: "tan⁻¹", snippet: "\\tan^{-1}(#?)" },
      { label: "ln", snippet: "\\ln(#?)" },
      { label: "log", snippet: "\\log(#?)" },
      { label: "log_b", snippet: "\\log_{#?}(#?)" },
      { label: "n!", snippet: "#@!" },
      { label: "nCr", snippet: "\\binom{#?}{#?}" },
      { label: "max", snippet: "\\max(#?)" },
    ],
  },
  {
    name: "Calculus",
    keys: [
      { label: "dy⁄dx", snippet: "\\frac{d#?}{d#?}" },
      { label: "∂⁄∂x", snippet: "\\frac{\\partial#?}{\\partial#?}" },
      { label: "∫", snippet: "\\int#?\\,d#?" },
      { label: "∫ᵃᵇ", snippet: "\\int_{#?}^{#?}#?\\,dx" },
      { label: "∑", snippet: "\\sum_{#?}^{#?}#?" },
      { label: "∏", snippet: "\\prod_{#?}^{#?}#?" },
      { label: "lim", snippet: "\\lim_{#?\\to#?}" },
      { label: "∇", snippet: "\\nabla" },
      { label: "∞", snippet: "\\infty" },
      { label: "Δ", snippet: "\\Delta" },
    ],
  },
  {
    name: "Relations",
    keys: [
      { label: "=", snippet: "=" },
      { label: "≠", snippet: "\\neq" },
      { label: "≈", snippet: "\\approx" },
      { label: "≤", snippet: "\\leq" },
      { label: "≥", snippet: "\\geq" },
      { label: "∝", snippet: "\\propto" },
      { label: "→", snippet: "\\to" },
      { label: "⇌", snippet: "\\rightleftharpoons" },
      { label: "∈", snippet: "\\in" },
      { label: "∴", snippet: "\\therefore" },
    ],
  },
  {
    name: "Greek",
    keys: [
      { label: "α", snippet: "\\alpha" },
      { label: "β", snippet: "\\beta" },
      { label: "γ", snippet: "\\gamma" },
      { label: "θ", snippet: "\\theta" },
      { label: "λ", snippet: "\\lambda" },
      { label: "μ", snippet: "\\mu" },
      { label: "σ", snippet: "\\sigma" },
      { label: "φ", snippet: "\\phi" },
      { label: "ω", snippet: "\\omega" },
      { label: "Ω", snippet: "\\Omega" },
    ],
  },
  {
    name: "Vectors",
    keys: [
      { label: "v⃗", snippet: "\\vec{#?}" },
      { label: "x̂", snippet: "\\hat{#?}" },
      { label: "x̄", snippet: "\\bar{#?}" },
      { label: "·", snippet: "\\cdot" },
      { label: "×", snippet: "\\times" },
      { label: "matrix", snippet: "\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}", wide: true },
      { label: "column", snippet: "\\begin{bmatrix}#?\\\\#?\\\\#?\\end{bmatrix}", wide: true },
    ],
  },
  {
    name: "Chemistry",
    keys: [
      { label: "H₂O", snippet: "H_{2}O" },
      { label: "x₂", snippet: "#@_{2}" },
      { label: "x²⁺", snippet: "#@^{2+}" },
      { label: "°", snippet: "^{\\circ}" },
      { label: "m/s²", snippet: "\\mathrm{m/s^{2}}" },
      { label: "mol", snippet: "\\mathrm{mol}" },
    ],
  },
];

export function MathKeypad({ onInsert }: { onInsert: (snippet: string) => void }) {
  const [group, setGroup] = useState(GROUPS[0]!.name);
  const active = GROUPS.find((entry) => entry.name === group) ?? GROUPS[0]!;

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {GROUPS.map((entry) => (
          <button
            key={entry.name}
            type="button"
            onClick={() => setGroup(entry.name)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
              entry.name === group
                ? "bg-gold/25 text-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {entry.name}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1.5 sm:grid-cols-6">
        {active.keys.map((key) => (
          <button
            key={key.label}
            type="button"
            onClick={() => onInsert(key.snippet)}
            className={cn(
              "rounded-md border border-border bg-background px-2 py-2 text-base font-medium leading-none hover:border-gold/70 hover:bg-gold/10",
              key.wide && "col-span-2 text-sm",
            )}
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
