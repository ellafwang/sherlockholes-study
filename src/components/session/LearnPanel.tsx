import { ArrowLeft, Send, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MathText } from "@/components/MathText";
import { LightbulbIcon } from "@/components/MysteryIcons";
import { Button } from "@/components/ui/button";
import { MathTextarea } from "@/components/MathTextarea";

export type LearnEntry = { id: string; role: string; content: string };

export function LearnPanel({
  entries,
  focus,
  covered,
  nextTopic,
  busy,
  voiceNotice,
  speaking,
  voiceLoading,
  onSend,
  onTeachTopic,
  onReplay,
  onStopVoice,
  onBack,
}: {
  entries: LearnEntry[];
  focus: string[];
  covered: string[];
  nextTopic: string | null;
  busy: boolean;
  voiceNotice: string | null;
  speaking: boolean;
  voiceLoading: boolean;
  onSend: (message: string) => void;
  onTeachTopic: (topic: string) => void;
  onReplay: (text: string) => void;
  onStopVoice: () => void;
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

  const done = new Set(covered.map((topic) => topic.trim().toLowerCase()));

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
        <>
          <p className="label-caps mt-3 text-muted-foreground">Lesson plan — tap one</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {focus.map((topic, index) => {
              const taught = done.has(topic.trim().toLowerCase());
              return (
                <button
                  key={`${topic}-${index}`}
                  type="button"
                  disabled={busy}
                  onClick={() => onTeachTopic(topic)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-60 ${
                    taught
                      ? "border-verdict-correct/60 bg-verdict-correct/15"
                      : "border-gold/60 bg-gold/15 hover:bg-gold/30"
                  }`}
                >
                  {taught ? "✓ " : ""}
                  {topic}
                </button>
              );
            })}
          </div>
        </>
      )}

      {(speaking || voiceLoading) && (
        <div className="mt-3 flex items-center gap-2 text-sm text-brass" aria-live="polite">
          <Volume2 className={`h-4 w-4 ${speaking ? "animate-pulse" : ""}`} />
          <span>{voiceLoading ? "Sherlock is clearing his throat…" : "Sherlock is speaking…"}</span>
          {speaking && (
            <button type="button" onClick={onStopVoice} className="label-caps text-brass hover:underline">
              Stop
            </button>
          )}
        </div>
      )}

      {voiceNotice && <p className="mt-3 text-sm text-muted-foreground">{voiceNotice}</p>}

      <div ref={logRef} className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {entries.length === 0 && !busy && (
          <p className="text-muted-foreground">
            Sherlock is opening his notebook on what you missed. Tap a topic above or ask him anything.
          </p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className={entry.role === "user" ? "text-right" : ""}>
            <p className="label-caps text-muted-foreground">
              {entry.role === "user" ? "You" : "Sherlock"}
            </p>
            <p className="whitespace-pre-line text-[0.98rem] leading-snug">
              <MathText>{entry.content}</MathText>
            </p>
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

      {nextTopic && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onTeachTopic(nextTopic)}
          className="mt-3 justify-start border-gold/60"
        >
          <LightbulbIcon className="mr-2 h-4 w-4" /> Explain “{nextTopic}”
        </Button>
      )}

      <div className="mt-4 flex items-end gap-2 border-t border-border pt-4">
        <MathTextarea
          value={draft}
          placeholder="Ask Sherlock to explain something…"
          className="min-h-20"
          onValueChange={setDraft}
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
