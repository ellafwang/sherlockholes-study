import type { SVGProps } from "react";

/** Speech bubble with a question mark — the Mid-Session Q&A mark. */
export function QuestionBubbleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <path
        d="M4 8.5A3.5 3.5 0 0 1 7.5 5h17A3.5 3.5 0 0 1 28 8.5v11a3.5 3.5 0 0 1-3.5 3.5H16l-7 5v-5H7.5A3.5 3.5 0 0 1 4 19.5v-11Z"
        fill="currentColor"
      />
      <path
        d="M13 11.6c.2-1.6 1.5-2.6 3.2-2.6 1.9 0 3.3 1.1 3.3 2.8 0 1.3-.7 2-1.9 2.8-.9.6-1.2 1-1.2 1.9v.4"
        stroke="var(--parchment)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16.3" cy="19.6" r="1.3" fill="var(--parchment)" />
    </svg>
  );
}

/** Treasure chest — the Session Feedback mark. */
export function TreasureChestIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <path d="M4 14h24v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V14Z" fill="currentColor" />
      <path
        d="M6 14a10 10 0 0 1 20 0"
        fill="var(--gold)"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <rect x="4" y="12.5" width="24" height="3.5" rx="1" fill="currentColor" />
      <rect x="13.6" y="16.4" width="4.8" height="7" rx="1.4" fill="var(--gold)" />
      <circle cx="16" cy="19.4" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** Lit bulb — the Learn from Sherlock mark. */
export function LightbulbIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <path
        d="M16 4a8.5 8.5 0 0 0-5 15.3c.8.6 1.2 1.3 1.3 2.2l.2 1.5h7l.2-1.5c.1-.9.5-1.6 1.3-2.2A8.5 8.5 0 0 0 16 4Z"
        fill="var(--gold)"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M13 25.5h6M13.8 28.5h4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16 3V.8M27 8.5l1.9-1.1M5 8.5 3.1 7.4M29.5 16h2.2M.3 16h2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Magnifying glass — used as the app mark. */
export function MagnifierIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <circle cx="13.5" cy="13" r="8.5" stroke="currentColor" strokeWidth="2.6" fill="var(--gold)" />
      <path d="M19.8 19.6 28 28" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

/** Detective case folder — the notebook/case-file mark. */
export function CaseFileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden {...props}>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h7l2.3 2.8H27A2 2 0 0 1 29 11v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5Z" fill="currentColor" />
      <path d="M3 12h26v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V12Z" fill="currentColor" stroke="var(--ink)" strokeWidth="1.5" />
      <path d="M8 15.5h16v8H8z" fill="var(--parchment)" stroke="var(--ink)" strokeWidth="1.3" />
      <path d="M11 18h10M11 21h7" stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="24.2" cy="8.8" r="2.7" fill="var(--gold)" stroke="var(--ink)" strokeWidth="1.2" />
    </svg>
  );
}
