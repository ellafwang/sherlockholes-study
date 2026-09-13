import { ArrowLeft, RotateCcw } from "lucide-react";

import { MathText } from "@/components/MathText";
import { LightbulbIcon, TreasureChestIcon } from "@/components/MysteryIcons";
import { Button } from "@/components/ui/button";

export type Report = {
  covered: string[];
  answeredWell: string[];
  gaps: string[];
  openQuestions: string[];
  subtopicTime: Record<string, number>;
  speakingSeconds: number;
  exampleCount: number;
  narrative: string;
};

const mmss = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

function List({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h4 className="label-caps">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-1 text-base text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1 text-[1.05rem]">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <span className="text-gold">•</span>
              <span>
                <MathText>{item}</MathText>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FeedbackPanel({
  report,
  loading,
  onBack,
  onLearn,
  onNewTeach,
}: {
  report: Report | null;
  loading: boolean;
  onBack: () => void;
  onLearn: () => void;
  onNewTeach: () => void;
}) {
  return (
    <section className="case-file animate-rise-in flex h-full flex-col p-5" aria-label="Session feedback">
      <div className="flex items-start justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-brass">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <TreasureChestIcon className="h-6 w-6 text-foreground" />
          <span className="label-caps">Feedback</span>
        </div>
      </div>

      {loading || !report ? (
        <p className="mt-8 text-muted-foreground">Sherlock is writing up his case notes…</p>
      ) : (
        <div className="mt-4 grid flex-1 gap-5 overflow-y-auto sm:grid-cols-[1fr_auto]">
          <div className="space-y-5 pr-1">
            <p className="text-lg leading-snug">
              <MathText>{report.narrative}</MathText>
            </p>

            <div className="flex flex-wrap gap-6 border-y border-border py-3">
              <div>
                <p className="label-caps text-muted-foreground">You spoke for</p>
                <p className="text-2xl font-semibold">{mmss(report.speakingSeconds)}</p>
              </div>
              <div>
                <p className="label-caps text-muted-foreground">Examples given</p>
                <p className="text-2xl font-semibold">{report.exampleCount}</p>
              </div>
            </div>

            <List
              title="Concepts you covered"
              items={report.covered}
              empty="Nothing landed clearly enough to count."
            />
            <List
              title="Answered well"
              items={report.answeredWell}
              empty="No questions answered fully yet."
            />
            <List
              title="Questions Sherlock still has"
              items={report.openQuestions.slice(0, 4)}
              empty="None — he's satisfied."
            />
            <List
              title="Missed or misunderstood"
              items={report.gaps}
              empty="Nothing flagged. Impressive."
            />

            <div>
              <h4 className="label-caps">Time per subtopic</h4>
              {Object.keys(report.subtopicTime).length === 0 ? (
                <p className="mt-1 text-base text-muted-foreground">No subtopics tracked.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {Object.entries(report.subtopicTime)
                    .sort((a, b) => b[1] - a[1])
                    .map(([topic, seconds]) => {
                      const total = Math.max(report.speakingSeconds, 1);
                      return (
                        <li key={topic}>
                          <div className="flex justify-between text-base">
                            <span>{topic}</span>
                            <span className="text-muted-foreground">{mmss(seconds)}</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-secondary">
                            <div
                              className="h-2 rounded-full bg-gold transition-all duration-700"
                              style={{ width: `${Math.min(100, (seconds / total) * 100)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:w-40">
            <button
              type="button"
              onClick={onLearn}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-foreground/20 bg-card p-4 transition-colors hover:border-gold"
            >
              <LightbulbIcon className="h-9 w-9 text-foreground" />
              <span className="label-caps text-center leading-tight">Learn from Sherlock</span>
            </button>
            <Button variant="secondary" onClick={onNewTeach}>
              <RotateCcw className="mr-2 h-4 w-4" /> Teach again
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
