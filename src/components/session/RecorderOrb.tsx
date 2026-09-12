import { Mic, MicOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The voice recorder button below Sherlock, with a live waveform of the
 * student's voice and a running word count of what has been said.
 */
export function RecorderOrb({
  listening,
  speaking,
  disabled,
  onToggle,
  label,
  levels,
  wordCount,
}: {
  listening: boolean;
  speaking: boolean;
  disabled?: boolean | undefined;
  onToggle: () => void;
  label?: string | undefined;
  levels?: number[] | undefined;
  wordCount?: number | undefined;
}) {
  const bars = levels ?? [];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-20 w-20 items-center justify-center">
        {speaking && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-gold/40" />
            <span className="absolute -inset-3 animate-pulse rounded-full border border-gold/50" />
          </>
        )}
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-pressed={listening}
          aria-label={listening ? "Stop recording and send to Sherlock" : "Start recording"}
          className={cn(
            "relative flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-300",
            listening
              ? "border-gold bg-foreground text-gold shadow-lg"
              : "border-foreground/30 bg-card text-foreground hover:border-foreground/60",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {listening ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
        </button>
      </div>

      {bars.length > 0 && (
        <div
          aria-hidden
          className={cn(
            "flex h-10 items-center gap-[3px] transition-opacity duration-300",
            listening ? "opacity-100" : "opacity-30",
          )}
        >
          {bars.map((level, index) => (
            <span
              key={index}
              className="w-[3px] rounded-full bg-brass"
              style={{ height: `${Math.max(4, level * 40)}px` }}
            />
          ))}
        </div>
      )}

      <span className="label-caps text-muted-foreground">
        {label ?? (listening ? (speaking ? "Hearing you" : "Listening…") : "Tap to speak")}
      </span>

      {typeof wordCount === "number" && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {wordCount} {wordCount === 1 ? "word" : "words"} spoken
        </span>
      )}
    </div>
  );
}
