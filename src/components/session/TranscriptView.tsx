import type { TranscriptTurn } from "@/lib/voice.functions";

/** Languages the transcriber can be pinned to (ISO-639-3 codes). */
export const TRANSCRIPT_LANGUAGES: { code: string; label: string }[] = [
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "por", label: "Portuguese" },
  { code: "ita", label: "Italian" },
  { code: "nld", label: "Dutch" },
  { code: "hin", label: "Hindi" },
  { code: "cmn", label: "Mandarin Chinese" },
  { code: "jpn", label: "Japanese" },
  { code: "kor", label: "Korean" },
  { code: "ara", label: "Arabic" },
];

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function speakerLabel(id: string): string {
  const match = /(\d+)/.exec(id);
  const index = match ? Number(match[1]) + 1 : 1;
  return `Speaker ${index}`;
}

/** Shows the diarized transcript, one block per speaker turn with timestamps. */
export function TranscriptView({
  turns,
  events,
  live,
}: {
  turns: TranscriptTurn[];
  events: string[];
  live?: string;
}) {
  if (turns.length === 0 && !live?.trim()) return null;

  return (
    <div className="mx-auto w-full max-w-xl text-left">
      <p className="label-caps text-muted-foreground">Transcript by speaker</p>
      <div className="mt-2 max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border/60 bg-card/70 p-3">
        {turns.map((turn, index) => (
          <div key={`${turn.speaker}-${turn.start}-${index}`} className="flex gap-3">
            <span className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-brass">
              {formatTime(turn.start)}
            </span>
            <div className="min-w-0">
              <p className="label-caps text-muted-foreground">{speakerLabel(turn.speaker)}</p>
              <p className="text-sm leading-snug text-foreground">{turn.text}</p>
            </div>
          </div>
        ))}
        {live?.trim() && (
          <div className="flex gap-3">
            <span className="w-14 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
              now
            </span>
            <p className="text-sm italic leading-snug text-muted-foreground">{live.trim()}</p>
          </div>
        )}
      </div>
      {events.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Also heard: {events.join(", ")}</p>
      )}
    </div>
  );
}
