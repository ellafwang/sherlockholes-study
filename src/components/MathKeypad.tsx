import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/MathText";
import { cn } from "@/lib/utils";

/**
 * A scientific-calculator style keypad that inserts LaTeX snippets.
 * `@` marks where the caret should land after insertion.
 */
type Key = { label: string; snippet: string; wide?: boolean };

const GROUPS: { name: string; keys: Key[] }[] = [
  {
    name: "Numbers",
    keys: [
      { label: "7", snippet: "7" },
      { label: "8", snippet: "8" },
      { label: "9", snippet: "9" },
      { label: "÷", snippet: "\\div " },
      { label: "×", snippet: "\\times " },
      { label: "4", snippet: "4" },
      { label: "5", snippet: "5" },
      { label: "6", snippet: "6" },
      { label: "+", snippet: "+" },
      { label: "−", snippet: "-" },
      { label: "1", snippet: "1" },
      { label: "2", snippet: "2" },
      { label: "3", snippet: "3" },
      { label: "( )", snippet: "\\left(@\\right)" },
      { label: "±", snippet: "\\pm " },
      { label: "0", snippet: "0" },
      { label: ".", snippet: "." },
      { label: "π", snippet: "\\pi " },
      { label: "e", snippet: "e" },
      { label: "%", snippet: "\\%" },
    ],
  },
  {
    name: "Powers & roots",
    keys: [
      { label: "x²", snippet: "@^{2}" },
      { label: "xⁿ", snippet: "@^{n}" },
      { label: "x_n", snippet: "@_{n}" },
      { label: "√", snippet: "\\sqrt{@}" },
      { label: "ⁿ√", snippet: "\\sqrt[n]{@}" },
      { label: "a/b", snippet: "\\frac{@}{b}" },
      { label: "|x|", snippet: "\\left|@\\right|" },
      { label: "eˣ", snippet: "e^{@}" },
      { label: "10ˣ", snippet: "10^{@}" },
      { label: "×10ⁿ", snippet: "\\times 10^{@}" },
    ],
  },
  {
    name: "Functions",
    keys: [
      { label: "sin", snippet: "\\sin(@)" },
      { label: "cos", snippet: "\\cos(@)" },
      { label: "tan", snippet: "\\tan(@)" },
      { label: "sin⁻¹", snippet: "\\sin^{-1}(@)" },
      { label: "cos⁻¹", snippet: "\\cos^{-1}(@)" },
      { label: "tan⁻¹", snippet: "\\tan^{-1}(@)" },
      { label: "ln", snippet: "\\ln(@)" },
      { label: "log", snippet: "\\log(@)" },
      { label: "log_b", snippet: "\\log_{b}(@)" },
      { label: "n!", snippet: "@!" },
      { label: "nCr", snippet: "\\binom{n}{r}" },
      { label: "max", snippet: "\\max(@)" },
    ],
  },
  {
    name: "Calculus",
    keys: [
      { label: "dy/dx", snippet: "\\frac{dy}{dx}" },
      { label: "∂/∂x", snippet: "\\frac{\\partial @}{\\partial x}" },
      { label: "∫", snippet: "\\int @\\,dx" },
      { label: "∫ᵃᵇ", snippet: "\\int_{a}^{b} @\\,dx" },
      { label: "∑", snippet: "\\sum_{n=1}^{\\infty} @" },
      { label: "∏", snippet: "\\prod_{n=1}^{N} @" },
      { label: "lim", snippet: "\\lim_{x \\to @}" },
      { label: "∇", snippet: "\\nabla @" },
      { label: "∞", snippet: "\\infty " },
      { label: "Δ", snippet: "\\Delta @" },
    ],
  },
  {
    name: "Relations",
    keys: [
      { label: "=", snippet: "=" },
      { label: "≠", snippet: "\\neq " },
      { label: "≈", snippet: "\\approx " },
      { label: "≤", snippet: "\\leq " },
      { label: "≥", snippet: "\\geq " },
      { label: "∝", snippet: "\\propto " },
      { label: "→", snippet: "\\to " },
      { label: "⇌", snippet: "\\rightleftharpoons " },
      { label: "∈", snippet: "\\in " },
      { label: "∴", snippet: "\\therefore " },
    ],
  },
  {
    name: "Greek",
    keys: [
      { label: "α", snippet: "\\alpha " },
      { label: "β", snippet: "\\beta " },
      { label: "γ", snippet: "\\gamma " },
      { label: "θ", snippet: "\\theta " },
      { label: "λ", snippet: "\\lambda " },
      { label: "μ", snippet: "\\mu " },
      { label: "σ", snippet: "\\sigma " },
      { label: "φ", snippet: "\\phi " },
      { label: "ω", snippet: "\\omega " },
      { label: "Ω", snippet: "\\Omega " },
    ],
  },
  {
    name: "Vectors & matrices",
    keys: [
      { label: "vec", snippet: "\\vec{@}" },
      { label: "hat", snippet: "\\hat{@}" },
      { label: "x̄", snippet: "\\bar{@}" },
      { label: "dot ·", snippet: "\\cdot " },
      { label: "cross ×", snippet: "\\times " },
      { label: "2×2", snippet: "\\begin{pmatrix} @ & b \\\\ c & d \\end{pmatrix}", wide: true },
      { label: "column", snippet: "\\begin{bmatrix} @ \\\\ y \\\\ z \\end{bmatrix}", wide: true },
    ],
  },
  {
    name: "Chemistry & units",
    keys: [
      { label: "H₂O", snippet: "H_{2}O" },
      { label: "sub ₙ", snippet: "@_{2}" },
      { label: "charge", snippet: "@^{2+}" },
      { label: "°", snippet: "^{\\circ}" },
      { label: "m/s²", snippet: "\\mathrm{m/s^{2}}" },
      { label: "mol", snippet: "\\mathrm{mol}" },
      { label: "text", snippet: "\\text{@}" },
    ],
  },
];

export function MathKeypad({
  onInsert,
  preview,
  onClose,
}: {
  onInsert: (snippet: string) => void;
  preview: string;
  onClose: () => void;
}) {
  const [group, setGroup] = useState(GROUPS[0].name);
  const active = GROUPS.find((entry) => entry.name === group) ?? GROUPS[0];

  return (
    <div className="mt-2 rounded-xl border border-gold/50 bg-card/95 p-3 shadow-lg">
      <div className="flex items-center justify-between gap-2">
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
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-6">
        {active.keys.map((key) => (
          <button
            key={key.label}
            type="button"
            onClick={() => onInsert(key.snippet)}
            className={cn(
              "rounded-md border border-border bg-background px-2 py-2 text-sm font-medium hover:border-gold/70 hover:bg-gold/10",
              key.wide && "col-span-2",
            )}
          >
            {key.label}
          </button>
        ))}
      </div>

      {preview.trim() && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="label-caps text-muted-foreground">Preview</p>
          <div className="mt-1 max-h-24 overflow-auto text-base">
            <MathText>{preview}</MathText>
          </div>
        </div>
      )}
    </div>
  );
}

export { GROUPS as MATH_KEYPAD_GROUPS };
export type { Key as MathKeypadKey };
export const MathKeypadToggle = Button;
