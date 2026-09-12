import { Mic, MicOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The voice recorder button below Sherlock. Rings ripple only while the
 * student's voice is actually being picked up.
 */
export function RecorderOrb({
  listening,
  speaking,
  disabled,
  onToggle,
  label,
}: {
  listening: boolean;
  speaking: boolean;
  disabled?: boolean | undefined;
  onToggle: () => void;
  label?: string | undefined;
}) {
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
          aria-label={listening ? "Stop recording" : "Start recording"}
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
      <span className="label-caps text-muted-foreground">
        {label ?? (listening ? (speaking ? "Hearing you" : "Listening…") : "Mic off")}
      </span>
    </div>
  );
}
