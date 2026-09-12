import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { MathText } from "@/components/MathText";
import { QuestionBubbleIcon } from "@/components/MysteryIcons";
import { RecorderOrb } from "@/components/session/RecorderOrb";
import { Button } from "@/components/ui/button";
import { MathTextarea } from "@/components/MathTextarea";
import type { Verdict } from "@/components/SherlockFace";

export type QaEntry = { id: string; role: string; content: string; verdict: string };

const VERDICT_TEXT: Record<string, string> = {
  green: "text-verdict-green",
  yellow: "text-brass",
  red: "text-verdict-red",
};

export function QaPanel({
  question,
  entries,
  busy,
  remaining,
  liveText,
  listening,
  micSupported,
  onToggleMic,
  onSubmit,
  onSkip,
  onBack,
  onFinish,
}: {
  question: string | null;
  entries: QaEntry[];
  busy: boolean;
  remaining: number;
  liveText: string;
  listening: boolean;
  micSupported: boolean;
  onToggleMic: () => void;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const [typed, setTyped] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length, busy]);

  const answer = (listening ? liveText : typed).trim();

  const submit = () => {
    if (!answer || busy) return;
    onSubmit(answer);
    setTyped("");
  };

  return (
    <section className="case-file animate-rise-in flex h-full flex-col p-5" aria-label="Mid-session questions">
      <div className="flex items-start justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-brass">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <QuestionBubbleIcon className="h-6 w-6 text-foreground" />
          <span className="label-caps">Q&amp;A</span>
        </div>
      </div>

      <div
        ref={logRef}
        className={
          entries.length === 0
            ? "hidden"
            : "mt-4 max-h-64 flex-1 space-y-3 overflow-y-auto pr-1"
        }
      >
        {entries.map((entry) => (
          <div key={entry.id} className={entry.role === "user" ? "text-right" : ""}>
            <p className="label-caps text-muted-foreground">
              {entry.role === "user" ? "You" : "Sherlock"}
            </p>
            <p className={`text-[0.95rem] leading-snug ${VERDICT_TEXT[entry.verdict] ?? ""}`}>
              <MathText>{entry.content}</MathText>
            </p>
          </div>
        ))}
      </div>

      {question ? (
        <>
          <p className="mt-4 border-t border-border pt-4 text-lg font-semibold leading-snug">
            <MathText>{question}</MathText>
          </p>
          <p className="label-caps mt-1 text-muted-foreground">
            {remaining > 0 ? `${remaining} question${remaining === 1 ? "" : "s"} left after this` : "Last one"}
          </p>

          <div className="mt-4 flex items-start gap-3">
            <MathTextarea
              value={listening ? liveText : typed}
              readOnly={listening}
              placeholder={micSupported ? "Answer out loud, or type here…" : "Type your answer…"}
              className="min-h-24"
              onValueChange={setTyped}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
              }}
            />
            {micSupported && (
              <RecorderOrb
                listening={listening}
                speaking={listening && liveText.length > 0}
                onToggle={onToggleMic}
                label={listening ? "Answering" : "Speak"}
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={submit} disabled={!answer || busy}>
              <Send className="mr-2 h-4 w-4" />
              {busy ? "Sherlock is thinking…" : "Answer"}
            </Button>
            <Button variant="ghost" onClick={onSkip} disabled={busy}>
              I don't know
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-lg font-semibold">That's everything I was wondering.</p>
          <p className="mt-1 text-muted-foreground">
            Open the case file to see how the explanation held up.
          </p>
          <Button className="mt-4" onClick={onFinish}>
            Session feedback
          </Button>
        </div>
      )}
    </section>
  );
}

export const verdictOf = (value: string): Verdict =>
  value === "green" || value === "yellow" || value === "red" ? value : "neutral";
