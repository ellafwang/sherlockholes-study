import { ArrowLeft, Send, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LightbulbIcon } from "@/components/MysteryIcons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type LearnEntry = { id: string; role: string; content: string };

export function LearnPanel({
  entries,
  focus,
  busy,
  voiceNotice,
  onSend,
  onReplay,
  onBack,
}: {
  entries: LearnEntry[];
  focus: string[];
  busy: boolean;
  voiceNotice: string | null;
  onSend: (message: string) => void;
  onReplay: (text: string) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length, busy]);

  const send = () => {
    const value = draft.trim();
    if (!value || busy) return;
    onSend(value);
    setDraft("");
  };

  return (
    <section className="case-file animate-rise-in flex h-full flex-col p-5" aria-label="Learn from Sherlock">
      <div className="flex items-start justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-brass">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <LightbulbIcon className="h-6 w-6 text-foreground" />
          <span className="label-caps">Learn from Sherlock</span>
        </div>
      </div>

      {focus.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {focus.map((topic, index) => (
            <span
              key={`${topic}-${index}`}
              className="rounded-full border border-gold/60 bg-gold/15 px-2.5 py-0.5 text-xs"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {voiceNotice && <p className="mt-3 text-sm text-muted-foreground">{voiceNotice}</p>}

      <div ref={logRef} className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {entries.length === 0 && !busy && (
          <p className="text-muted-foreground">
            Ask about anything you missed, or say “start with the first gap”.
          </p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className={entry.role === "user" ? "text-right" : ""}>
            <p className="label-caps text-muted-foreground">
              {entry.role === "user" ? "You" : "Sherlock"}
            </p>
            <p className="whitespace-pre-line text-[0.98rem] leading-snug">{entry.content}</p>
            {entry.role !== "user" && (
              <button
                type="button"
                onClick={() => onReplay(entry.content)}
                className="label-caps mt-1 inline-flex items-center gap-1 text-brass hover:underline"
              >
                <Volume2 className="h-3.5 w-3.5" /> Hear it
              </button>
            )}
          </div>
        ))}
        {busy && <p className="text-muted-foreground">Sherlock is composing his explanation…</p>}
      </div>

      <div className="mt-4 flex items-end gap-2 border-t border-border pt-4">
        <Textarea
          value={draft}
          placeholder="Ask Sherlock to explain something…"
          className="min-h-20"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={!draft.trim() || busy} size="icon" aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
