import { useEffect, useRef, useState } from "react";

import neutralFace from "@/assets/sherlock-neutral.png";
import greenFace from "@/assets/sherlock-green.png";
import yellowFace from "@/assets/sherlock-yellow.png";
import redFace from "@/assets/sherlock-red.png";
import { cn } from "@/lib/utils";

export type Verdict = "neutral" | "green" | "yellow" | "red";

const FACES: Record<Verdict, string> = {
  neutral: neutralFace,
  green: greenFace,
  yellow: yellowFace,
  red: redFace,
};

const HALO: Record<Verdict, string> = {
  neutral: "color-mix(in oklab, var(--muted-foreground) 35%, transparent)",
  green: "color-mix(in oklab, var(--verdict-green) 45%, transparent)",
  yellow: "color-mix(in oklab, var(--verdict-yellow) 55%, transparent)",
  red: "color-mix(in oklab, var(--verdict-red) 45%, transparent)",
};

const LABEL: Record<Verdict, string> = {
  neutral: "Listening",
  green: "That tracks",
  yellow: "Not quite following",
  red: "That can't be right",
};

/**
 * Sherlock, cross-fading between his four expressions.
 * Both layers stay mounted so a verdict change is a fade, never a flash.
 */
export function SherlockFace({
  verdict,
  size = "lg",
  className,
}: {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [current, setCurrent] = useState<Verdict>(verdict);
  const [previous, setPrevious] = useState<Verdict | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (verdict === current) return;
    setPrevious(current);
    setCurrent(verdict);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPrevious(null), 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [verdict, current]);

  const dimensions =
    size === "sm" ? "h-24 w-24" : size === "md" ? "h-40 w-40" : "h-56 w-56 sm:h-72 sm:w-72";

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div className={cn("relative", dimensions)}>
        <div
          aria-hidden
          className="animate-soft-glow absolute inset-0 rounded-full blur-2xl transition-[background] duration-700"
          style={{ background: `radial-gradient(circle, ${HALO[current]}, transparent 70%)` }}
        />
        {previous && (
          <img
            src={FACES[previous]}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-500"
          />
        )}
        <img
          key={current}
          src={FACES[current]}
          alt={`Sherlock looking ${current === "neutral" ? "attentive" : LABEL[current].toLowerCase()}`}
          className="animate-verdict-pop absolute inset-0 h-full w-full object-contain drop-shadow-sm"
        />
      </div>
      <span
        className="label-caps mt-2 transition-colors duration-500"
        style={{
          color:
            current === "neutral"
              ? "var(--muted-foreground)"
              : current === "green"
                ? "var(--verdict-green)"
                : current === "yellow"
                  ? "var(--brass)"
                  : "var(--verdict-red)",
        }}
      >
        {LABEL[current]}
      </span>
    </div>
  );
}
